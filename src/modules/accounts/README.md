# Accounts Module

Module quản lý tài khoản gửi email (Brevo, SendGrid, Mailgun, AWS SES).

## Cấu trúc

```
src/accounts/
├── dto/
│   ├── create-account.dto.ts      # DTO tạo account mới
│   ├── update-account.dto.ts      # DTO cập nhật account
│   └── account-response.dto.ts    # DTO response (ẩn credentials)
├── accounts.controller.ts          # REST API endpoints
├── accounts.service.ts             # Business logic
├── accounts.module.ts              # Module definition
└── README.md
```

## API Endpoints

### 1. Tạo Account mới
```http
POST /accounts
Content-Type: application/json

{
  "clerkUserId": "user_123",
  "name": "Brevo Primary Account",
  "provider": "brevo",
  "credentials": {
    "api_key": "xkeysib-xxx"
  },
  "dailyLimit": 300,
  "isActive": true
}
```

**Providers hỗ trợ:**
- `brevo` - Brevo (Sendinblue)
- `sendgrid` - SendGrid
- `mailgun` - Mailgun
- `aws_ses` - AWS SES

**Credentials theo provider:**

**Brevo:**
```json
{
  "api_key": "xkeysib-xxx"
}
```

**SendGrid:**
```json
{
  "api_key": "SG.xxx"
}
```

**Mailgun:**
```json
{
  "api_key": "key-xxx",
  "domain": "mg.yourdomain.com",
  "region": "us"
}
```

**AWS SES:**
```json
{
  "access_key_id": "AKIA...",
  "secret_access_key": "xxx",
  "region": "us-east-1",
  "from_email": "noreply@yourdomain.com"
}
```

### 2. Lấy danh sách accounts
```http
GET /accounts
GET /accounts?clerkUserId=user_123
```

### 3. Lấy account theo ID
```http
GET /accounts/:id
```

### 4. Lấy accounts đang active
```http
GET /accounts/active
GET /accounts/active?clerkUserId=user_123
```

### 5. Lấy accounts còn quota
```http
GET /accounts/available
GET /accounts/available?clerkUserId=user_123
```

### 6. Lấy credentials (decrypted)
```http
GET /accounts/:id/credentials
```

⚠️ **Chú ý:** Endpoint này trả về credentials đã decrypt. Chỉ sử dụng khi cần thiết!

### 7. Cập nhật account
```http
PATCH /accounts/:id
Content-Type: application/json

{
  "name": "Brevo Updated",
  "dailyLimit": 500,
  "isActive": true
}
```

### 8. Tăng số email đã gửi
```http
PATCH /accounts/:id/increment-sent
Content-Type: application/json

{
  "count": 1
}
```

### 9. Reset counter hàng ngày
```http
PATCH /accounts/:id/reset-counter
```

### 10. Reset tất cả counters
```http
POST /accounts/reset-all-counters
```

### 11. Xóa account
```http
DELETE /accounts/:id
```

## Sử dụng Service

### Inject service vào module khác:

```typescript
import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  // ...
})
export class YourModule {}
```

### Sử dụng trong service:

```typescript
import { Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class EmailService {
  constructor(private readonly accountsService: AccountsService) {}

  async sendEmail() {
    // Lấy account còn quota
    const availableAccounts = await this.accountsService.getAvailableAccounts('user_123');

    if (availableAccounts.length === 0) {
      throw new Error('No available email accounts');
    }

    // Lấy account đầu tiên (ít email gửi nhất)
    const account = availableAccounts[0];

    // Lấy credentials để gửi email
    const credentials = await this.accountsService.getCredentials(account.id);

    // Gửi email với credentials...

    // Tăng counter sau khi gửi thành công
    await this.accountsService.incrementSentToday(account.id);
  }
}
```

## Bảo mật

### Encryption Key

Credentials được mã hóa bằng AES-256-CBC. Key được lưu trong environment variable:

```env
ENCRYPTION_KEY=97b412fc6b6069a112852a12dea607d5a8e802b16b282a2e5a47ad4d7554409a
```

**Generate key mới:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Response DTO

`AccountResponseDto` tự động ẩn field `credentialsEncrypted` khi trả về API response.

## Daily Limit & Counter

- `dailyLimit`: Số lượng email tối đa có thể gửi mỗi ngày
- `sentToday`: Số email đã gửi hôm nay
- `lastResetDate`: Ngày reset counter lần cuối

**Auto-reset:**
Tạo một cron job để reset counters mỗi ngày:

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountsService } from './accounts/accounts.service';

@Injectable()
export class TasksService {
  constructor(private readonly accountsService: AccountsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyCounters() {
    await this.accountsService.resetAllDailyCounters();
    console.log('Daily counters reset successfully');
  }
}
```

## Testing

```bash
# Test tạo account
curl -X POST http://localhost:3000/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "clerkUserId": "user_123",
    "name": "Test Brevo",
    "provider": "brevo",
    "credentials": {"api_key": "test-key"},
    "dailyLimit": 100
  }'

# Test lấy accounts
curl http://localhost:3000/accounts

# Test lấy accounts available
curl http://localhost:3000/accounts/available?clerkUserId=user_123
```
