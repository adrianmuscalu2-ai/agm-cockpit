import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Transaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class LifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async getStateByCode(companyId: string, code: string, tx: Transaction = this.prisma) {
    const state = await tx.lifecycleState.findFirst({
      where: {
        companyId,
        code,
        isActive: true,
      },
    });

    if (!state) {
      throw new NotFoundException(`Lifecycle state not found: ${code}`);
    }

    return state;
  }
}
