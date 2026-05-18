import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Ride } from './ride.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Ride)
  @JoinColumn({ name: 'ride_id' })
  ride: Ride;

  @Column()
  ride_id: string;

  @Column()
  from_user_id: string;

  @Column()
  to_user_id: string;

  @Column({ type: 'int' })
  score: number; // 1-5

  @Column({ nullable: true })
  comment: string;

  @CreateDateColumn()
  created_at: Date;
}
