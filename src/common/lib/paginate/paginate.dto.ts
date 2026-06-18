import { Type } from 'class-transformer';
import { IsOptional, IsString, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @IsString()
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;
}
