import { IsInt, Min } from 'class-validator';

export class OverrideScoreDto {
  @IsInt()
  @Min(0)
  totalScore: number;
}
