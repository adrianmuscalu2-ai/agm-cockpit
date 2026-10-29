import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { GovernanceV2Persistence } from './governance-v2.persistence';
import { GovernanceV2RuntimeService } from './governance-v2.runtime';

@Module({
  imports: [PrismaModule],
  providers: [{
    provide: GovernanceV2RuntimeService,
    inject: [PrismaService],
    useFactory: (prisma: PrismaService) => new GovernanceV2RuntimeService(new GovernanceV2Persistence(prisma)),
  }],
  exports: [GovernanceV2RuntimeService],
})
export class GovernanceV2Module {}
