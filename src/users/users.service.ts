import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    id: string,
    dto: Partial<User>,
  ): Promise<User> {
    await this.userRepo.update(id, dto);
    return this.findById(id);
  }

  async getRideHistory(userId: string) {
    // Delegated to rides module but user can fetch from here
    return [];
  }
}
