import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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
  name: string;

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
  access_token: string;
}

export class SignInWithGoogleDto {
  googleToken: string;
}