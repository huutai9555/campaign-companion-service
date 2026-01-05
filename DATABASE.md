# Database Configuration - TypeORM + PostgreSQL

## Cài đặt ban đầu

### 1. Tạo database PostgreSQL

```bash
# Kết nối vào PostgreSQL
psql -U postgres

# Tạo database
CREATE DATABASE campaign_companion;

# Thoát
\q
```

### 2. Cấu hình môi trường

Chỉnh sửa file `.env` với thông tin database của bạn:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=campaign_companion
```

### 3. Chạy ứng dụng

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

## Cấu trúc thư mục

```
src/
├── config/
│   └── database.config.ts    # Cấu hình TypeORM
├── entities/                  # Các entity/models
│   ├── base.entity.ts        # Base entity với id, createdAt, updatedAt
│   ├── user.entity.ts        # Entity mẫu
│   └── index.ts              # Export tất cả entities
└── data-source.ts            # DataSource cho migrations
```

## Tạo Entity mới

### Ví dụ tạo một entity mới:

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: true })
  inStock: boolean;
}
```

### Sau đó export trong `src/entities/index.ts`:

```typescript
export * from './base.entity';
export * from './user.entity';
export * from './product.entity'; // Thêm dòng này
```

## Sử dụng Repository trong Module

### 1. Tạo module mới (ví dụ: users module)

```bash
nest g module users
nest g service users
nest g controller users
```

### 2. Import TypeOrmModule trong module

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

### 3. Sử dụng Repository trong Service

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.userRepository.update(id, userData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}
```

## Migrations (Tùy chọn)

### 1. Tạo migration

```bash
npm run typeorm migration:generate -- -n CreateUsersTable
```

### 2. Chạy migration

```bash
npm run typeorm migration:run
```

### 3. Rollback migration

```bash
npm run typeorm migration:revert
```

## Lưu ý quan trọng

1. **Synchronize**: Hiện tại `synchronize: true` được bật trong development mode. Điều này sẽ tự động tạo/cập nhật bảng dựa trên entities. **KHÔNG BAO GIỜ** sử dụng trong production!

2. **Migrations**: Trong production, nên sử dụng migrations thay vì synchronize.

3. **Environment Variables**: Luôn sử dụng file `.env` cho các thông tin nhạy cảm và không commit file này lên git.

## Các query phổ biến

```typescript
// Tìm một record
await repository.findOne({ where: { email: 'test@example.com' } });

// Tìm nhiều records với điều kiện
await repository.find({
  where: { isActive: true },
  order: { createdAt: 'DESC' },
  take: 10
});

// Đếm
await repository.count({ where: { isActive: true } });

// Update
await repository.update({ id: '123' }, { fullName: 'New Name' });

// Delete
await repository.delete({ id: '123' });

// Soft delete (cần thêm @DeleteDateColumn)
await repository.softDelete({ id: '123' });

// Query builder
await repository
  .createQueryBuilder('user')
  .where('user.email LIKE :email', { email: '%@example.com' })
  .andWhere('user.isActive = :isActive', { isActive: true })
  .getMany();
```

## Tài liệu tham khảo

- [TypeORM Documentation](https://typeorm.io/)
- [NestJS TypeORM Documentation](https://docs.nestjs.com/techniques/database)
