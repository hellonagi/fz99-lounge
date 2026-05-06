import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'newsSlug must be lowercase alphanumeric with hyphens' })
  @MaxLength(120)
  newsSlug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
