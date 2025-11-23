import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SubmitScreenshotDto {
  @IsNotEmpty()
  @IsUUID()
  @IsString()
  matchId: string;
}
