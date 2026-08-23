import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, Min } from 'class-validator';
import { AGENT_RUNTIME_LIFECYCLES, type AgentRuntimeLifecycle } from '../agent-runtime-event.contract';

export class AppendAgentRuntimeEventDto {
  @IsUUID() eventId!: string;
  @IsString() @Length(1, 160) mandateId!: string;
  @IsString() @Length(1, 120) agentId!: string;
  @IsString() @Length(1, 160) dossierId!: string;
  @IsIn(AGENT_RUNTIME_LIFECYCLES) lifecycle!: AgentRuntimeLifecycle;
  @IsInt() @Min(1) sequence!: number;
  @IsISO8601() occurredAt!: string;
  @IsString() @Length(1, 4096) evidenceRef!: string;
  @IsOptional() @IsString() @MaxLength(4096) outputRef?: string;
  @IsOptional() @Matches(/^[a-f0-9]{64}$/i) evidenceHash?: string;
  @IsString() @Length(1, 4096) detail!: string;
}
