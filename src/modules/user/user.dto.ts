import { IsOptional, IsString } from 'class-validator';

export class ChangeUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}

export class UserResponseDto {
  @IsString()
  id: ID;

  @IsString()
  email: Email;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  lastSeen: Date;

  @IsString()
  createdAt: Date;

  @IsString()
  updatedAt: Date;
}
