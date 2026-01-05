# Redis Usage Guide

## Cài đặt

Redis đã được cài đặt và cấu hình trong dự án. CacheModule được đăng ký global nên bạn có thể sử dụng trong bất kỳ module nào.

## Cấu hình

Các biến môi trường trong file `.env`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=300
```

## Cách sử dụng trong Service

### 1. Inject CACHE_MANAGER

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class YourService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getDataWithCache(key: string) {
    // Lấy data từ cache
    const cachedData = await this.cacheManager.get(key);

    if (cachedData) {
      return cachedData;
    }

    // Nếu không có trong cache, lấy từ database
    const data = await this.fetchFromDatabase();

    // Lưu vào cache
    await this.cacheManager.set(key, data, 600); // TTL: 600 seconds

    return data;
  }

  async invalidateCache(key: string) {
    await this.cacheManager.del(key);
  }

  async clearAllCache() {
    await this.cacheManager.reset();
  }

  private async fetchFromDatabase() {
    // Your database logic here
    return {};
  }
}
```

### 2. Sử dụng Cache Decorator (Interceptor)

```typescript
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@Controller('users')
@UseInterceptors(CacheInterceptor)
export class UsersController {
  @Get()
  @CacheKey('all_users')
  @CacheTTL(60) // 60 seconds
  async findAll() {
    // Response sẽ được cache tự động
    return [];
  }
}
```

### 3. Các phương thức Cache Manager

```typescript
// Set giá trị với TTL tùy chỉnh
await this.cacheManager.set('key', 'value', 300);

// Get giá trị
const value = await this.cacheManager.get('key');

// Xóa một key
await this.cacheManager.del('key');

// Xóa tất cả cache
await this.cacheManager.reset();

// Lưu nhiều giá trị
await this.cacheManager.store.mset([
  ['key1', 'value1'],
  ['key2', 'value2'],
], 300);

// Lấy nhiều giá trị
const values = await this.cacheManager.store.mget('key1', 'key2');
```

## Khởi chạy Redis

### Sử dụng Docker

```bash
docker run --name redis -p 6379:6379 -d redis
```

### Sử dụng Docker Compose

Thêm vào file `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### Cài đặt trực tiếp (macOS)

```bash
brew install redis
brew services start redis
```

### Cài đặt trực tiếp (Ubuntu/Debian)

```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

## Kiểm tra kết nối

```bash
# Kết nối Redis CLI
redis-cli

# Ping để kiểm tra
127.0.0.1:6379> ping
PONG

# Xem tất cả keys
127.0.0.1:6379> keys *

# Xem giá trị của một key
127.0.0.1:6379> get your_key
```
