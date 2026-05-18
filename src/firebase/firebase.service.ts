import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App;

  constructor(private config: ConfigService) {}

  onModuleInit() {
  const databaseURL = this.config.get<string>('FIREBASE_DATABASE_URL');

  try {
    if (!admin.apps.length) {
      //  Read from env variable, not a file path
      const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');

      if (!serviceAccountJson) {
        this.logger.error('FIREBASE_SERVICE_ACCOUNT env variable is not set');
        return;
      }

      const serviceAccount = JSON.parse(serviceAccountJson);

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount), //  pass object not path
        databaseURL,
      });
      this.logger.log('Firebase Admin SDK initialized');
    } else {
      this.app = admin.app();
    }
  } catch (error) {
    this.logger.error('Firebase init failed', error.message);
  }
}
  // onModuleInit() {
  //   const serviceAccountPath = this.config.get<string>(
  //     'FIREBASE_SERVICE_ACCOUNT_PATH',
  //     './firebase-service-account.json',
  //   );
  //   const databaseURL = this.config.get<string>('FIREBASE_DATABASE_URL');

  //   try {
  //     if (!admin.apps.length) {
  //       this.app = admin.initializeApp({
  //         credential: admin.credential.cert(serviceAccountPath),
  //         databaseURL,
  //       });
  //       this.logger.log('Firebase Admin SDK initialized');
  //     } else {
  //       this.app = admin.app();
  //     }
  //   } catch (error) {
  //     this.logger.error('Firebase init failed', error.message);
  //   }
  // }

  // ── Push Notifications ────────────────────────────────────────────────

  async sendPushNotification(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: data || {},
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'uber_channel' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });
      this.logger.log(`FCM sent to ${fcmToken.substring(0, 20)}...`);
    } catch (error) {
      this.logger.error('FCM error', error.message);
    }
  }

  async sendMulticastNotification(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!fcmTokens.length) return;
    try {
      await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title, body },
        data: data || {},
        android: { priority: 'high' },
      });
    } catch (error) {
      this.logger.error('Multicast FCM error', error.message);
    }
  }

  // ── Realtime Database ─────────────────────────────────────────────────

  async updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    heading: number = 0,
  ): Promise<void> {
    try {
      await admin
        .database()
        .ref(`driver_locations/${driverId}`)
        .set({ lat, lng, heading, updated_at: Date.now() });
    } catch (error) {
      this.logger.error('Firebase RTDB write error', error.message);
    }
  }

  async updateRideStatus(
    rideId: string,
    status: string,
    driverId?: string,
    etaMinutes?: number,
  ): Promise<void> {
    try {
      await admin
        .database()
        .ref(`ride_status/${rideId}`)
        .set({
          status,
          driver_id: driverId || null,
          eta_minutes: etaMinutes || 0,
          updated_at: Date.now(),
        });
    } catch (error) {
      this.logger.error('Firebase RTDB ride status error', error.message);
    }
  }

  async removeDriverLocation(driverId: string): Promise<void> {
    try {
      await admin.database().ref(`driver_locations/${driverId}`).remove();
    } catch (error) {
      this.logger.error('Firebase RTDB remove error', error.message);
    }
  }
}
