import { Type } from 'class-transformer';
import { IsOptional, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;
}
