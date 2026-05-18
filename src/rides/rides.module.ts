import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { Ride } from './entities/ride.entity';
import { Rating } from './entities/rating.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { RidesGateway } from '../gateways/rides.gateway';
import { AuthModule } from '../auth/auth.module'; // ← provides JwtService

@Module({
  imports: [
    TypeOrmModule.forFeature([Ride, Rating, Driver, User]),
    NotificationsModule,
    AuthModule, // ← RidesGateway injects JwtService from here
  ],
  controllers: [RidesController],
  providers: [RidesService, RidesGateway],
  exports: [RidesService],
})
export class RidesModule {}
