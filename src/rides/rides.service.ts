import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride, RideStatus, RideType } from './entities/ride.entity';
import { Rating } from './entities/rating.entity';
import { Driver, DriverStatus } from '../drivers/entities/driver.entity';
import { User } from '../users/entities/user.entity';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RidesGateway } from '../gateways/rides.gateway';
import axios from 'axios';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    @InjectRepository(Ride) private rideRepo: Repository<Ride>,
    @InjectRepository(Rating) private ratingRepo: Repository<Rating>,
    @InjectRepository(Driver) private driverRepo: Repository<Driver>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private firebaseService: FirebaseService,
    private notificationsService: NotificationsService,
    private ridesGateway: RidesGateway,
  ) {}

  // ── Request a Ride ────────────────────────────────────────────────────

  async requestRide(
    riderId: string,
    dto: {
      pickup_lat: number;
      pickup_lng: number;
      pickup_address: string;
      dropoff_lat: number;
      dropoff_lng: number;
      dropoff_address: string;
      ride_type?: RideType;
    },
  ): Promise<Ride> {
    // Check no active ride
    const activeRide = await this.rideRepo.findOne({
      where: {
        rider_id: riderId,
        status: RideStatus.SEARCHING,
      },
    });
    if (activeRide) throw new BadRequestException('You already have an active ride request');

    // Estimate fare
    const distance = this.calculateDistance(
      dto.pickup_lat, dto.pickup_lng,
      dto.dropoff_lat, dto.dropoff_lng,
    );
    const fare = this.calculateFare(distance, dto.ride_type || RideType.ECONOMY);

    const ride = this.rideRepo.create({
      rider_id: riderId,
      pickup_lat: dto.pickup_lat,
      pickup_lng: dto.pickup_lng,
      pickup_address: dto.pickup_address,
      dropoff_lat: dto.dropoff_lat,
      dropoff_lng: dto.dropoff_lng,
      dropoff_address: dto.dropoff_address,
      ride_type: dto.ride_type || RideType.ECONOMY,
      status: RideStatus.SEARCHING,
      fare,
      distance_km: parseFloat(distance.toFixed(2)),
    });

    const savedRide = await this.rideRepo.save(ride);

    // Update Firebase ride status
    await this.firebaseService.updateRideStatus(savedRide.id, RideStatus.SEARCHING);

    // Broadcast ride request to nearby drivers via Socket.io
    const nearbyDrivers = await this.findNearbyDrivers(dto.pickup_lat, dto.pickup_lng);
    await this.ridesGateway.broadcastRideRequest(savedRide, nearbyDrivers);

    // Push notification to nearby drivers
    await this.notificationsService.notifyNearbyDrivers(nearbyDrivers, savedRide);

    this.logger.log(`Ride ${savedRide.id} created, broadcasted to ${nearbyDrivers.length} drivers`);
    return savedRide;
  }

  // ── Driver Accepts Ride ───────────────────────────────────────────────

  async acceptRide(driverId: string, rideId: string): Promise<Ride> {
    const ride = await this.findById(rideId);
    if (ride.status !== RideStatus.SEARCHING) {
      throw new BadRequestException('Ride is no longer available');
    }

    const driver = await this.driverRepo.findOne({ where: { user_id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    ride.driver_id = driver.id;
    ride.driver = driver;
    ride.status = RideStatus.ACCEPTED;
    ride.accepted_at = new Date();
    driver.status = DriverStatus.ON_TRIP;

    await this.rideRepo.save(ride);
    await this.driverRepo.save(driver);

    // Update Firebase
    await this.firebaseService.updateRideStatus(rideId, RideStatus.ACCEPTED, driver.id, 5);

    // Notify rider via Socket.io + FCM
    const rider = await this.userRepo.findOne({ where: { id: ride.rider_id } });
    this.ridesGateway.notifyRider(ride.rider_id, 'ride_accepted', {
      ride,
      driver: { ...driver, user: rider },
    });

    if (rider?.fcm_token) {
      await this.notificationsService.sendNotification(
        rider.fcm_token,
        '🚗 Driver Found!',
        `${driver.vehicle_make} ${driver.vehicle_model} is on the way`,
        { ride_id: rideId, type: 'ride_accepted' },
      );
    }

    return this.findById(rideId);
  }

  // ── Update Ride Status ────────────────────────────────────────────────

  async updateStatus(
    driverId: string,
    rideId: string,
    newStatus: RideStatus,
  ): Promise<Ride> {
    const ride = await this.findById(rideId);
    const driver = await this.driverRepo.findOne({ where: { user_id: driverId } });

    if (!driver || ride.driver_id !== driver.id) {
      throw new BadRequestException('Not authorized for this ride');
    }

    const validTransitions: Record<RideStatus, RideStatus[]> = {
      [RideStatus.ACCEPTED]: [RideStatus.DRIVER_ARRIVING],
      [RideStatus.DRIVER_ARRIVING]: [RideStatus.DRIVER_ARRIVED],
      [RideStatus.DRIVER_ARRIVED]: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED],
      [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED],
      [RideStatus.REQUESTED]: [RideStatus.CANCELLED],
      [RideStatus.SEARCHING]: [RideStatus.CANCELLED],
      [RideStatus.COMPLETED]: [],
      [RideStatus.CANCELLED]: [],
    };

    if (!validTransitions[ride.status]?.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from ${ride.status} to ${newStatus}`);
    }

    ride.status = newStatus;

    if (newStatus === RideStatus.IN_PROGRESS) {
      ride.picked_up_at = new Date();
    }

    if (newStatus === RideStatus.COMPLETED) {
      ride.completed_at = new Date();
      driver.status = DriverStatus.ONLINE;
      driver.total_trips += 1;
      driver.total_earnings += ride.fare;
      await this.driverRepo.save(driver);
    }

    await this.rideRepo.save(ride);

    // Update Firebase
    await this.firebaseService.updateRideStatus(rideId, newStatus, driver.id);

    // Notify rider
    const rider = await this.userRepo.findOne({ where: { id: ride.rider_id } });
    this.ridesGateway.notifyRider(ride.rider_id, 'ride_status_update', {
      status: newStatus,
      ride_id: rideId,
    });

    const statusMessages: Partial<Record<RideStatus, string>> = {
      [RideStatus.DRIVER_ARRIVING]: '🚗 Driver is on the way!',
      [RideStatus.DRIVER_ARRIVED]: '📍 Your driver has arrived!',
      [RideStatus.IN_PROGRESS]: '🛣️ Trip started!',
      [RideStatus.COMPLETED]: '✅ Trip completed. Rate your driver!',
    };

    if (rider?.fcm_token && statusMessages[newStatus]) {
      await this.notificationsService.sendNotification(
        rider.fcm_token,
        statusMessages[newStatus],
        '',
        { ride_id: rideId, type: 'status_update', status: newStatus },
      );
    }

    return this.findById(rideId);
  }

  // ── Cancel Ride ───────────────────────────────────────────────────────

  async cancelRide(userId: string, rideId: string, reason?: string): Promise<Ride> {
    const ride = await this.findById(rideId);
    const cancelableStatuses = [
      RideStatus.REQUESTED,
      RideStatus.SEARCHING,
      RideStatus.ACCEPTED,
      RideStatus.DRIVER_ARRIVING,
    ];

    if (!cancelableStatuses.includes(ride.status)) {
      throw new BadRequestException('Ride cannot be cancelled at this stage');
    }

    ride.status = RideStatus.CANCELLED;
    ride.cancellation_reason = reason;
    await this.rideRepo.save(ride);

    if (ride.driver_id) {
      await this.driverRepo.update({ id: ride.driver_id }, { status: DriverStatus.ONLINE });
    }

    await this.firebaseService.updateRideStatus(rideId, RideStatus.CANCELLED);
    this.ridesGateway.notifyRider(ride.rider_id, 'ride_cancelled', { ride_id: rideId, reason });

    return ride;
  }

  // ── Rate Ride ─────────────────────────────────────────────────────────

  async rateRide(
    fromUserId: string,
    rideId: string,
    score: number,
    comment?: string,
  ): Promise<Rating> {
    const ride = await this.findById(rideId);
    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('Can only rate completed rides');
    }

    const toUserId =
      fromUserId === ride.rider_id ? ride.driver.user_id : ride.rider_id;

    const existing = await this.ratingRepo.findOne({
      where: { ride_id: rideId, from_user_id: fromUserId },
    });
    if (existing) throw new BadRequestException('Already rated this ride');

    const rating = this.ratingRepo.create({
      ride_id: rideId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      score,
      comment,
    });

    await this.ratingRepo.save(rating);

    // Update average rating for the recipient
    const avgResult = await this.ratingRepo
      .createQueryBuilder('r')
      .select('AVG(r.score)', 'avg')
      .where('r.to_user_id = :id', { id: toUserId })
      .getRawOne();

    await this.userRepo.update(toUserId, {
      rating: parseFloat(parseFloat(avgResult.avg).toFixed(1)),
    });

    return rating;
  }

  // ── Get Ride History ──────────────────────────────────────────────────

  async getRideHistory(userId: string, role: string): Promise<Ride[]> {
    const where = role === 'driver'
      ? { driver: { user_id: userId } }
      : { rider_id: userId };

    return this.rideRepo.find({
      where,
      order: { created_at: 'DESC' },
      take: 20,
    });
  }

  async getActiveRide(userId: string): Promise<Ride | null> {
    return this.rideRepo.findOne({
      where: [
        { rider_id: userId, status: RideStatus.SEARCHING },
        { rider_id: userId, status: RideStatus.ACCEPTED },
        { rider_id: userId, status: RideStatus.DRIVER_ARRIVING },
        { rider_id: userId, status: RideStatus.DRIVER_ARRIVED },
        { rider_id: userId, status: RideStatus.IN_PROGRESS },
      ],
    });
  }

  async estimateFare(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
  ) {
    const distance = this.calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    return {
      distance_km: parseFloat(distance.toFixed(2)),
      fares: {
        [RideType.ECONOMY]: this.calculateFare(distance, RideType.ECONOMY),
        [RideType.COMFORT]: this.calculateFare(distance, RideType.COMFORT),
        [RideType.XL]: this.calculateFare(distance, RideType.XL),
      },
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  async findById(id: string): Promise<Ride> {
    const ride = await this.rideRepo.findOne({ where: { id } });
    if (!ride) throw new NotFoundException('Ride not found');
    return ride;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private calculateFare(distanceKm: number, type: RideType): number {
    const rates = {
      [RideType.ECONOMY]: { base: 200, perKm: 80 },
      [RideType.COMFORT]: { base: 300, perKm: 120 },
      [RideType.XL]: { base: 400, perKm: 150 },
    };
    const { base, perKm } = rates[type];
    return parseFloat((base + distanceKm * perKm).toFixed(2));
  }

  private async findNearbyDrivers(lat: number, lng: number): Promise<Driver[]> {
    return this.driverRepo
      .createQueryBuilder('driver')
      .leftJoinAndSelect('driver.user', 'user')
      .where('driver.status = :status', { status: DriverStatus.ONLINE })
      .andWhere(
        `(6371 * acos(cos(radians(:lat)) * cos(radians(driver.current_lat)) *
         cos(radians(driver.current_lng) - radians(:lng)) +
         sin(radians(:lat)) * sin(radians(driver.current_lat)))) <= :radius`,
        { lat, lng, radius: 8 },
      )
      .limit(10)
      .getMany();
  }
}
