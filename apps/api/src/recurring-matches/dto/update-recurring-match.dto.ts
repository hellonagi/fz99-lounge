import { PartialType } from '@nestjs/mapped-types';
import { CreateRecurringMatchDto } from './create-recurring-match.dto';

export class UpdateRecurringMatchDto extends PartialType(CreateRecurringMatchDto) {}
