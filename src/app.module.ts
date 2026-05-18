import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DriversModule } from './drivers/drivers.module';
import { RidesModule } from './rides/rides.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FirebaseModule } from './firebase/firebase.module';
import { User } from './users/entities/user.entity';
import { Driver } from './drivers/entities/driver.entity';
import { Ride } from './rides/entities/ride.entity';
import { Payment } from './payments/entities/payment.entity';
import { Rating } from './rides/entities/rating.entity';

@Module({
  imports: [
    // Config — loads .env globally
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM + PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'uber_db'),
        entities: [User, Driver, Ride, Payment, Rating],
        synchronize: config.get('NODE_ENV') !== 'production', // auto-migrate in dev
        logging: config.get('NODE_ENV') === 'development',
        ssl: config.get('NODE_ENV') === 'production'  //  only SSL in prod
      ? { rejectUnauthorized: false }
      : false,
  
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    FirebaseModule,
    AuthModule,
    UsersModule,
    DriversModule,
    RidesModule,
    PaymentsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
