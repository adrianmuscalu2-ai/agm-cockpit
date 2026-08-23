import { IsIn } from 'class-validator';

export class ExecuteAgentInspectorDto {
  @IsIn(['COMPLETED', 'FAILED'])
  expectedOutcome!: 'COMPLETED' | 'FAILED';
}
