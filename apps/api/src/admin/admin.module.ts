import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [AuthModule, RatingModule],
  controllers: [AdminController],
})
export class AdminModule {}