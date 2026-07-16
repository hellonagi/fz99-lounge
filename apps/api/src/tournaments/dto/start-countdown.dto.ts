import { IsEnum, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { League } from '@prisma/client';

export class StartCountdownDto {
  // 対象ラウンド(GP番号)。省略時は現在IN_PROGRESS → 次のWAITINGの順で解決
  @IsOptional()
  @IsInt()
  @Min(1)
  matchNumber?: number;

  @IsOptional()
  @IsEnum(League)
  league?: League;

  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'passcode must be 4 digits' })
  passcode?: string;
}
