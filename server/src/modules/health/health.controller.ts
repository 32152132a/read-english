import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '检查服务与数据库状态' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException('数据库连接不可用');
    }
  }
}
