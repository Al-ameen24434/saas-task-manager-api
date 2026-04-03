import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { SortOrder } from '@common/dto/pagination.dto';

export class CommentQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Comments default to oldest-first (chronological conversation flow)
  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.ASC;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 20);
  }
}