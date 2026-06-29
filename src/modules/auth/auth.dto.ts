import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignInDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: Email;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsOptional()
  password?: string;
}

export class SignUpDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: Email;

  @IsString()
  @MinLength(3, { message: 'Name is Required' })
  @MaxLength(120)
  fullName: string;

  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30)
  @IsOptional()
  username?: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsOptional()
  password?: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: Email;

  @IsString()
  oldPassword: string;

  @IsString()
  newPassword: string;
}

export class SignInResponseDto {
  @ApiProperty()
  access_token: string;
}

export class SignInWithGoogleDto {
  googleToken: string;
}

export class LogoutResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  logout: boolean;
}
