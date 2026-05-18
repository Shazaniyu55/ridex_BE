import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';

export enum UserRole {
  RIDER = 'rider',
  DRIVER = 'driver',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  full_name: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.RIDER })
  role: UserRole;

  @Column({ nullable: true })
  fcm_token: string;

  @Column({ nullable: true })
  otp_code: string;

  @Column({ nullable: true, type: 'bigint' })
  otp_expires_at: number;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: 0, type: 'float' })
  rating: number;

  @Column({ default: 0 })
  total_rides: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
