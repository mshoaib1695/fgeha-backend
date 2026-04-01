import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ToBoolean } from '../../common/transformers/to-boolean.transformer';

export class UpdateAppSettingsDto {
  @ApiPropertyOptional({ description: 'News section heading shown in app home', example: 'Latest News' })
  @IsOptional()
  @IsString()
  newsSectionTitle?: string;

  @ApiPropertyOptional({ description: 'Header text on news detail screen. Leave empty to hide.', example: 'News' })
  @IsOptional()
  @IsString()
  newsDetailHeader?: string;

  @ApiPropertyOptional({ description: 'Show heading above news carousel on home screen.', example: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  showNewsSectionHeading?: boolean;

  @ApiPropertyOptional({ description: 'Show title and "Read more" overlay on news carousel banner.', example: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  showNewsCarouselOverlay?: boolean;

  @ApiPropertyOptional({ description: 'Show rating/review modal to users. When off, never show.', example: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  ratingEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Outstanding-payment blocking mode for services.',
    enum: ['blockOnAnyDue', 'blockAfterGracePeriod'],
    example: 'blockAfterGracePeriod',
  })
  @IsOptional()
  @IsString()
  paymentBlockingMode?: 'blockOnAnyDue' | 'blockAfterGracePeriod';

  @ApiPropertyOptional({
    description: 'Default grace period in days before blocking when grace mode is active.',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  paymentGraceDaysDefault?: number;

  @ApiPropertyOptional({
    description: 'Support email shown to residents for dues queries.',
    example: 'support@fgeha.online',
  })
  @IsOptional()
  @IsString()
  duesSupportEmail?: string;

  @ApiPropertyOptional({
    description: 'Support phone shown to residents for dues queries.',
    example: '+92 300 0000000',
  })
  @IsOptional()
  @IsString()
  duesSupportPhone?: string;
}
