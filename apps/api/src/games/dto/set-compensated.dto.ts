import { IsBoolean } from 'class-validator';

export class SetCompensatedDto {
  @IsBoolean()
  compensated: boolean;
}
