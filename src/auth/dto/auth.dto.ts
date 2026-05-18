import { IsString, IsPhoneNumber, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class SendOtpDto {
  @IsString()
  phone: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class VerifyOtpDto {
  @IsString()
  phone: string;

  @IsString()
  otp: string;
}

export class SaveFcmTokenDto {
  @IsString()
  fcm_token: string;
}
