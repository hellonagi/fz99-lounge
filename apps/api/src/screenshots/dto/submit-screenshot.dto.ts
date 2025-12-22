import { IsNotEmpty, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitScreenshotDto {
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  gameId: number;
}
