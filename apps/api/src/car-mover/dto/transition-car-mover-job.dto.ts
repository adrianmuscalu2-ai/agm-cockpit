import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { carMoverStates, type CarMoverState } from '../car-mover.contract';

export class TransitionCarMoverJobDto {
  @IsIn(carMoverStates) toState!: CarMoverState;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsString() assignedDriverUserId?: string;
}
