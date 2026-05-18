import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, SaveFcmTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('fcm-token')
  saveFcmToken(@Request() req, @Body() dto: SaveFcmTokenDto) {
    return this.authService.saveFcmToken(req.user.id, dto.fcm_token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return { user: req.user };
  }
}
