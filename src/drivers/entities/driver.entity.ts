import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DriverStatus {
  OFFLINE = 'offline',
  ONLINE = 'online',
  ON_TRIP = 'on_trip',
}

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  // Vehicle info
  @Column()
  vehicle_make: string;

  @Column()
  vehicle_model: string;

  @Column()
  vehicle_year: string;

  @Column()
  vehicle_color: string;

  @Column({ unique: true })
  license_plate: string;

  @Column({ nullable: true })
  vehicle_photo_url: string;

  // License
  @Column()
  drivers_license_number: string;

  @Column({ nullable: true })
  license_photo_url: string;

  // Status & location
  @Column({
    type: 'enum',
    enum: DriverStatus,
    default: DriverStatus.OFFLINE,
  })
  status: DriverStatus;

  @Column({ type: 'float', nullable: true })
  current_lat: number;

  @Column({ type: 'float', nullable: true })
  current_lng: number;

  // Stats
  @Column({ default: 0, type: 'float' })
  rating: number;

  @Column({ default: 0 })
  total_trips: number;

  @Column({ default: 0, type: 'float' })
  total_earnings: number;

  @Column({ default: false })
  is_verified: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
