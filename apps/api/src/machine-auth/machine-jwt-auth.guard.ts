import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MachineJwtAuthGuard extends AuthGuard('machine-jwt') {}
