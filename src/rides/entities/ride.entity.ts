import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Driver } from '../../drivers/entities/driver.entity';

export enum RideStatus {
  REQUESTED = 'requested',
  SEARCHING = 'searching',
  ACCEPTED = 'accepted',
  DRIVER_ARRIVING = 'driver_arriving',
  DRIVER_ARRIVED = 'driver_arrived',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RideType {
  ECONOMY = 'economy',
  COMFORT = 'comfort',
  XL = 'xl',
}

@Entity('rides')
export class Ride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'rider_id' })
  rider: User;

  @Column()
  rider_id: string;

  @ManyToOne(() => Driver, { nullable: true, eager: true })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ nullable: true })
  driver_id: string;

  // Pickup
  @Column({ type: 'float' })
  pickup_lat: number;

  @Column({ type: 'float' })
  pickup_lng: number;

  @Column()
  pickup_address: string;

  // Dropoff
  @Column({ type: 'float' })
  dropoff_lat: number;

  @Column({ type: 'float' })
  dropoff_lng: number;

  @Column()
  dropoff_address: string;

  // Ride details
  @Column({ type: 'enum', enum: RideStatus, default: RideStatus.REQUESTED })
  status: RideStatus;

  @Column({ type: 'enum', enum: RideType, default: RideType.ECONOMY })
  ride_type: RideType;

  @Column({ type: 'float', nullable: true })
  fare: number;

  @Column({ type: 'float', nullable: true })
  distance_km: number;

  @Column({ type: 'int', nullable: true })
  duration_minutes: number;

  @Column({ nullable: true })
  cancellation_reason: string;

  @Column({ nullable: true, type: 'timestamp' })
  accepted_at: Date;

  @Column({ nullable: true, type: 'timestamp' })
  picked_up_at: Date;

  @Column({ nullable: true, type: 'timestamp' })
  completed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
