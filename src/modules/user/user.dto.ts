import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProfileVisibility, WhoCanMessage } from './user.entity';

export class ChangeUserDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(120)
  fullName?: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(30)
  username?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsEnum(ProfileVisibility)
  @IsOptional()
  profileVisibility?: ProfileVisibility;

  @IsEnum(WhoCanMessage)
  @IsOptional()
  whoCanMessage?: WhoCanMessage;
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
  fullName: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ enum: ProfileVisibility })
  profileVisibility: ProfileVisibility;

  @ApiProperty({ enum: WhoCanMessage })
  whoCanMessage: WhoCanMessage;

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
