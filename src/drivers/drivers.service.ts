 import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverStatus } from './entities/driver.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver) private driverRepo: Repository<Driver>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private firebaseService: FirebaseService,
  ) {}

  // ── Fix 1: explicit cast so TypeScript picks the single-entity save overload
  async registerDriver(userId: string, dto: any): Promise<Driver> {
    const existing = await this.driverRepo.findOne({ where: { user_id: userId } });
    if (existing) throw new BadRequestException('Already registered as driver');

    await this.userRepo.update(userId, { role: UserRole.DRIVER });

    const driver: Driver = this.driverRepo.create({
      ...(dto as Partial<Driver>),
      user_id: userId,
    });
    // Cast return to Driver — TypeScript needs the hint to pick the correct overload
    return (await this.driverRepo.save(driver)) as Driver;
  }

  async findByUserId(userId: string): Promise<Driver> {
    const driver = await this.driverRepo.findOne({ where: { user_id: userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  async toggleOnlineStatus(
    userId: string,
    isOnline: boolean,
    lat?: number,
    lng?: number,
  ): Promise<Driver> {
    const driver = await this.findByUserId(userId);
    driver.status = isOnline ? DriverStatus.ONLINE : DriverStatus.OFFLINE;
    if (lat) driver.current_lat = lat;
    if (lng) driver.current_lng = lng;

    await this.driverRepo.save(driver);

    if (isOnline && lat && lng) {
      await this.firebaseService.updateDriverLocation(driver.id, lat, lng);
    } else if (!isOnline) {
      await this.firebaseService.removeDriverLocation(driver.id);
    }

    return driver;
  }

  async updateLocation(
    userId: string,
    lat: number,
    lng: number,
    heading: number,
  ): Promise<void> {
    const driver = await this.findByUserId(userId);
    driver.current_lat = lat;
    driver.current_lng = lng;
    await this.driverRepo.save(driver);
    await this.firebaseService.updateDriverLocation(driver.id, lat, lng, heading);
  }

  // ── Fix 2: replace .orderByRaw() with .addSelect() + .orderBy() ──────────
  async findNearbyDrivers(
    lat: number,
    lng: number,
    radiusKm: number = 5,
  ): Promise<Driver[]> {
    const distanceExpr = `(
      6371 * acos(
        LEAST(1.0,
          cos(radians(${lat})) * cos(radians(driver.current_lat)) *
          cos(radians(driver.current_lng) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(driver.current_lat))
        )
      )
    )`;

    return this.driverRepo
      .createQueryBuilder('driver')
      .addSelect(distanceExpr, 'distance_km')
      .where('driver.status = :status', { status: DriverStatus.ONLINE })
      .andWhere(`${distanceExpr} <= :radius`, { radius: radiusKm })
      .orderBy('distance_km', 'ASC')
      .limit(10)
      .getMany();
  }

  async getDriverStats(userId: string) {
    const driver = await this.findByUserId(userId);
    return {
      total_trips: driver.total_trips,
      total_earnings: driver.total_earnings,
      rating: driver.rating,
      status: driver.status,
    };
  }
}
