import { Module } from '@nestjs/common';
import { CanonicalAuthorityController } from './canonical-authority.controller';
import { CanonicalAuthorityLoader } from './canonical-authority.loader';
import { CanonicalAuthorityService } from './canonical-authority.service';
import { CanonicalAuthorityRuntimeOverlay } from './canonical-authority.overlay';

@Module({
  controllers: [CanonicalAuthorityController],
  providers: [CanonicalAuthorityLoader, CanonicalAuthorityService, CanonicalAuthorityRuntimeOverlay],
  exports: [CanonicalAuthorityLoader, CanonicalAuthorityService, CanonicalAuthorityRuntimeOverlay],
})
export class CanonicalAuthorityModule {}
