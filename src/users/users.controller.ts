import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@Request() req) {
    return { user: req.user };
  }

  @Patch('profile')
  updateProfile(@Request() req, @Body() body: any) {
    const { otp_code, otp_expires_at, ...allowedFields } = body;
    return this.usersService.updateProfile(req.user.id, allowedFields);
  }
}
