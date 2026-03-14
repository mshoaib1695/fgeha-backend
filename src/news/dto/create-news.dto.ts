import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ToBoolean } from '../../common/transformers/to-boolean.transformer';

export class CreateNewsDto {
  @ApiProperty({ description: 'Image URL (required, from upload)', example: '/news-images/xxx.jpg' })
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({ description: 'News heading/title' })
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional({ description: 'Rich text content (HTML)' })
  @IsOptional()
  @IsString()
  content?: string | null;

  @ApiPropertyOptional({ description: 'Display order (lower = first)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'When true, tapping the slide opens the detail page.', default: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  openDetail?: boolean;
}
