import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import { AccountsModule } from './modules/accounts/accounts.module';
import { ClerkClientProvider } from './providers/clerk-client.provider';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { RedisModule } from './modules/redis/redis.module';
import { BullModule } from '@nestjs/bullmq';
import { EmailImportSessionsModule } from './modules/email-import-sessions/email-import-sessions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: '.env',
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
    }),
    // forRootAsync (lấy cấu env file) forRoot không thể truy cập env
    TypeOrmModule.forRootAsync({
      inject: [ConfigService], // Inject service vào factory
      useFactory: (configService: ConfigService) =>
        configService.get('database'),
    }),
    RedisModule,
    AccountsModule,
    CampaignsModule,
    AuthModule,
    EmailImportSessionsModule,
    DashboardModule,
  ],
  providers: [
    ClerkClientProvider,
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
})
export class AppModule {}
