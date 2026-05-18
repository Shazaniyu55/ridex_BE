import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { Driver } from './entities/driver.entity';
import { User } from '../users/entities/user.entity';
import { FirebaseModule } from 'src/firebase/firebase.module';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, User]), FirebaseModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
