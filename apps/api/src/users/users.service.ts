import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    const users = await this.prisma.user.findMany({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      take: 2,
    });

    return users.length === 1 ? users[0] : null;
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }
}
