import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}

export class UserResponseDto {
  @ApiProperty()
  @IsString()
  id: ID;

  @ApiProperty()
  @IsString()
  email: Email;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty()
  @IsString()
  lastSeenAt: Date;

  @ApiProperty({ required: false })
  isOnline?: boolean;

  @ApiProperty()
  @IsString()
  createdAt: Date;

  @ApiProperty()
  @IsString()
  updatedAt: Date;
}

export class UserProfileResponseDto extends UserResponseDto {
  @ApiProperty()
  postsCount: number;

  @ApiProperty()
  friendsCount: number;

  @ApiProperty()
  isFriend: boolean;
}
