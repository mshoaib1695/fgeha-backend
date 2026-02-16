import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsObject, IsOptional, MaxLength } from 'class-validator';

export type OptionType = 'form' | 'list' | 'rules' | 'link' | 'phone';

export class CreateRequestTypeOptionDto {
  @ApiProperty()
  @IsNumber()
  requestTypeId: number;

  @ApiProperty({ example: 'Order Water Tanker', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  label: string;

  @ApiProperty({ enum: ['form', 'list', 'rules', 'link', 'phone'] })
  @IsEnum(['form', 'list', 'rules', 'link', 'phone'])
  optionType: OptionType;

  @ApiPropertyOptional({
    description: 'JSON: form={ issueImage: "none"|"optional"|"required" }, list={ listKey }, rules={ content|rules[] }, link={ url }, phone={ phoneNumber }',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Image URL (e.g. from upload)', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;
}
