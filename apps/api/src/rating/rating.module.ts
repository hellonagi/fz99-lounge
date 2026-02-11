import { Module } from '@nestjs/common';
import { ClassicRatingService } from './classic-rating.service';
import { TeamClassicRatingService } from './team-classic-rating.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ClassicRatingService, TeamClassicRatingService],
  exports: [ClassicRatingService, TeamClassicRatingService],
})
export class RatingModule {}
