import { IsBoolean, IsOptional } from 'class-validator';

export class SetDisqualifiedDto {
  // 省略時はtrue(失格にする)。falseでフラグだけ解除
  @IsOptional()
  @IsBoolean()
  disqualified?: boolean;
}
