import { IsNotEmpty, IsInt, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ScreenshotType } from '@prisma/client';

export class SubmitScreenshotDto {
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  gameId: number;

  @IsOptional()
  @IsEnum(ScreenshotType)
  type?: ScreenshotType = ScreenshotType.INDIVIDUAL;
}
