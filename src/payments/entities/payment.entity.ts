import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Ride } from '../../rides/entities/ride.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CARD = 'card',
  CASH = 'cash',
  WALLET = 'wallet',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Ride)
  @JoinColumn({ name: 'ride_id' })
  ride: Ride;

  @Column()
  ride_id: string;

  @Column()
  rider_id: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({ default: 'NGN' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ nullable: true })
  gateway_reference: string;

  @Column({ nullable: true })
  gateway_response: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
