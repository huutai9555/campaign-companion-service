import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api/v1');

  // Tăng limit cho JSON
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // ← SỬA ĐÂY: Đổi port 3000 → 4000 và thêm '0.0.0.0'
  await app.listen(4000, '0.0.0.0');

  console.log(`Application is running on: http://localhost:4000`);
}
bootstrap();
