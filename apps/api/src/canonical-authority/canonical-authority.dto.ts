import { IsBoolean, IsDateString, IsIn, IsString, MaxLength } from 'class-validator';
import { canonicalAuthorityDomains } from './canonical-authority.contract';

export class EvaluateCanonicalAuthorityDto {
  @IsIn(canonicalAuthorityDomains) domain!: 'ROUTING_TOLL' | 'LEGISLATION_SAFETY';
  @IsString() @MaxLength(180) sourceId!: string;
  @IsString() @MaxLength(20) jurisdiction!: string;
  @IsDateString() evaluatedAt!: string;
  @IsIn(['NORMATIVE', 'CONTEXTUAL']) purpose!: 'NORMATIVE' | 'CONTEXTUAL';
  @IsBoolean() scopeConfirmed!: boolean;
}
