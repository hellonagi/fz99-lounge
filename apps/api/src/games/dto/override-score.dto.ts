import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class OverrideScoreDto {
  @IsInt()
  @Min(0)
  totalScore: number;

  // 補填扱い(順位表にC表示)にするか。省略時はtrue(従来挙動)。
  // モデレーターの通常のスコア修正はfalseで呼ぶ
  @IsOptional()
  @IsBoolean()
  compensated?: boolean;
}
