import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { Driver } from '../drivers/entities/driver.entity';
import { Ride } from '../rides/entities/ride.entity';

@Injectable()
export class NotificationsService {
  constructor(private firebaseService: FirebaseService) {}

  async sendNotification(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await this.firebaseService.sendPushNotification(fcmToken, title, body, data);
  }

  async notifyNearbyDrivers(drivers: Driver[], ride: Ride): Promise<void> {
    const tokens = drivers
      .filter((d) => d.user?.fcm_token)
      .map((d) => d.user.fcm_token);

    if (!tokens.length) return;

    await this.firebaseService.sendMulticastNotification(
      tokens,
      '🆕 New Ride Request',
      `${ride.pickup_address} → ${ride.dropoff_address} | ₦${ride.fare}`,
      {
        type: 'new_ride_request',
        ride_id: ride.id,
        fare: String(ride.fare),
      },
    );
  }

  async notifyRideCompletion(
    riderFcmToken: string,
    driverFcmToken: string,
    rideId: string,
    fare: number,
  ): Promise<void> {
    await Promise.all([
      this.firebaseService.sendPushNotification(
        riderFcmToken,
        '✅ Trip Complete',
        `Total fare: ₦${fare}. Please rate your driver.`,
        { type: 'ride_completed', ride_id: rideId },
      ),
      this.firebaseService.sendPushNotification(
        driverFcmToken,
        '💰 Trip Earnings',
        `You earned ₦${fare} on this trip!`,
        { type: 'ride_completed', ride_id: rideId },
      ),
    ]);
  }
}
