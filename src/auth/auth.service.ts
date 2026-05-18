import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../users/entities/user.entity';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import axios from 'axios';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ── Send OTP ──────────────────────────────────────────────────────────

async sendOtp(dto: SendOtpDto): Promise<{ message: string }> {
  const otp = this.generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  let user = await this.userRepo.findOne({ where: { phone: dto.phone } });
  if (!user) {
    user = this.userRepo.create({
      phone: dto.phone,
      role: dto.role || UserRole.RIDER,
    });
  } else {
    // ← ADD THIS: update role on every login
    user.role = dto.role || user.role;
  }

  user.otp_code = otp;
  user.otp_expires_at = expiresAt;
  await this.userRepo.save(user);

  await this.sendSmsOtp(dto.phone, otp);
  return { message: 'OTP sent successfully' };
}

  // ── Verify OTP ────────────────────────────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto): Promise<{
    access_token: string;
    user: Partial<User>;
    is_new_user: boolean;
  }> {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) throw new UnauthorizedException('User not found');

    // In development, accept "000000" as universal OTP
    const isDev = this.config.get('NODE_ENV') === 'development';
    const isValidOtp =
      (isDev && dto.otp === '000000') ||
      (user.otp_code === dto.otp && Date.now() < Number(user.otp_expires_at));

    if (!isValidOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const isNewUser = !user.full_name;

    // Clear OTP
    user.otp_code = null;
    user.otp_expires_at = null;
    await this.userRepo.save(user);

    const token = this.generateToken(user);

    return {
      access_token: token,
      user: this.sanitizeUser(user),
      is_new_user: isNewUser,
    };
  }

  // ── Save FCM Token ────────────────────────────────────────────────────

  async saveFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepo.update(userId, { fcm_token: fcmToken });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });
  }

  private sanitizeUser(user: User): Partial<User> {
    const { otp_code, otp_expires_at, ...safe } = user as any;
    return safe;
  }

  private async sendSmsOtp(phone: string, otp: string): Promise<void> {
    const isDev = this.config.get('NODE_ENV') === 'development';
    if (isDev) {
      this.logger.log(`📱 DEV OTP for ${phone}: ${otp}`);
      return;
    }

    try {
      // Twilio integration
      const accountSid = this.config.get('TWILIO_ACCOUNT_SID');
      const authToken = this.config.get('TWILIO_AUTH_TOKEN');
      const from = this.config.get('TWILIO_PHONE_NUMBER');

      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        new URLSearchParams({
          From: from,
          To: phone,
          Body: `Your Uber OTP is: ${otp}. Valid for 10 minutes.`,
        }),
        { auth: { username: accountSid, password: authToken } },
      );
    } catch (error) {
      this.logger.error('SMS send failed', error.message);
      throw new BadRequestException('Failed to send OTP');
    }
  }
}
