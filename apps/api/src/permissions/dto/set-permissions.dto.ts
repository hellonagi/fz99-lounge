import { IsArray, IsEnum } from 'class-validator';
import { ModeratorPermission } from '@prisma/client';

export class SetPermissionsDto {
  @IsArray()
  @IsEnum(ModeratorPermission, { each: true })
  permissions: ModeratorPermission[];
}
