import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PermissionsService } from './permissions.service';
import { SetPermissionsDto } from './dto/set-permissions.dto';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get('moderators')
  async getModerators() {
    return this.permissionsService.getModerators();
  }

  @Put('users/:userId')
  async setUserPermissions(
    @Param('userId') userId: string,
    @Body() dto: SetPermissionsDto,
    @Req() req: Request,
  ) {
    const admin = req.user as any;
    return this.permissionsService.setUserPermissions(
      parseInt(userId, 10),
      dto.permissions,
      admin.id,
    );
  }
}
