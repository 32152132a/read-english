import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CosModule } from './integrations/cos/cos.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, CosModule, HealthModule],
})
export class AppModule {}
