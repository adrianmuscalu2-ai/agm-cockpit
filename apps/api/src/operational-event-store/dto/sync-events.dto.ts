import { Allow, IsArray, ArrayMaxSize } from 'class-validator';
export class SyncOperationalEventsDto {
  @IsArray() @ArrayMaxSize(100) @Allow() events!: unknown[];
}
