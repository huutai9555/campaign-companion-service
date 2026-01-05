import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const RedisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: (configService: ConfigService) => {
    return new Redis({
      host: configService.get<string>('REDIS_HOST') || 'localhost',
      port: configService.get<number>('REDIS_PORT') || 6379,
      password: configService.get<string>('REDIS_PASSWORD'),
      db: configService.get<number>('REDIS_DB') || 0,
    });
  },
  inject: [ConfigService],
};
