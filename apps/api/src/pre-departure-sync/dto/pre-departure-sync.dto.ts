import { Allow, IsInt, Min } from 'class-validator';

export class CreatePreDepartureSessionDto {
  @Allow()
  session!: unknown;
}
export class UpdatePreDepartureSessionDto {
  @Allow()
  session!: unknown;

  @IsInt()
  @Min(0)
  expectedServerRevision!: number;
}
