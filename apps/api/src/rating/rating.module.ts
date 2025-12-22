import { Module } from '@nestjs/common';
import { ClassicRatingService } from './classic-rating.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ClassicRatingService],
  exports: [ClassicRatingService],
})
export class RatingModule {}
