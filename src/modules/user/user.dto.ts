import { IsOptional, IsString } from 'class-validator';

export class ChangeUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}
