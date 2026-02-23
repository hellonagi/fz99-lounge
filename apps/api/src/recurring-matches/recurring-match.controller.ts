import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RecurringMatchService } from './recurring-match.service';
import { CreateRecurringMatchDto } from './dto/create-recurring-match.dto';
import { UpdateRecurringMatchDto } from './dto/update-recurring-match.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserRole, ModeratorPermission } from '@prisma/client';

@Controller('recurring-matches')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Permissions(ModeratorPermission.CREATE_MATCH)
export class RecurringMatchController {
  constructor(private recurringMatchService: RecurringMatchService) {}

  @Post()
  async create(@Body() dto: CreateRecurringMatchDto, @Req() req: Request) {
    const user = req.user as any;
    return this.recurringMatchService.create(dto, user.id);
  }

  @Get()
  async findAll() {
    return this.recurringMatchService.findAll();
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRecurringMatchDto, @Req() req: Request) {
    const user = req.user as any;
    return this.recurringMatchService.update(parseInt(id, 10), dto, user.id);
  }

  @Patch(':id/toggle')
  async toggleEnabled(
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.recurringMatchService.toggleEnabled(parseInt(id, 10), enabled, user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.recurringMatchService.delete(parseInt(id, 10));
  }
}
