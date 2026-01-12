# Campaign Email Rate Limiting System

## Tổng quan

Hệ thống gửi email campaign với cơ chế rate limiting tự động dựa trên cấu hình của từng email provider. Queue tự quản lý việc gửi và reschedule mà không cần cron job bên ngoài.

---

## Email Provider Configs

Mỗi provider có các giới hạn khác nhau được định nghĩa trong `src/helpers/email-provider-config.ts`:

| Provider | Daily Limit | Max Per Hour | Delay Between Emails |
|----------|-------------|--------------|----------------------|
| Gmail    | 500         | 100          | 3000ms (3s)          |
| Outlook  | 300         | 60           | 4000ms (4s)          |
| Hotmail  | 300         | 60           | 4000ms (4s)          |
| Yahoo    | 500         | 80           | 5000ms (5s)          |
| Custom   | 1000        | 200          | 2000ms (2s)          |

---

## Cấu trúc Database

### Account Entity

```typescript
// Tracking fields
sentToday: number;        // Số email đã gửi trong ngày
sentThisHour: number;     // Số email đã gửi trong giờ hiện tại
lastResetDate: Date;      // Mốc thời gian reset daily counter
hourStartedAt: Date;      // Mốc thời gian bắt đầu giờ hiện tại
```

---

## Flow Chi Tiết

### 1. Khởi động Campaign

```
User clicks "Start Campaign"
         ↓
campaignsService.start()
         ↓
Add job to queue: campaign-email-sending-immediate
         ↓
CampaignEmailConsumer.process() được gọi
```

### 2. Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PROCESS JOB                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Load campaign với relations (accounts, templates)        │
│                                                              │
│  2. Check status:                                            │
│     - completed/failed → skip                                │
│     - other → set to 'running'                               │
│                                                              │
│  3. Get pending recipients                                   │
│     - Nếu không còn → mark completed                         │
│                                                              │
│  4. For each account:                                        │
│     ┌─────────────────────────────────────────────────────┐  │
│     │ a. Reset daily counter nếu >= 24h từ lastResetDate  │  │
│     │ b. Reset hourly counter nếu >= 60min từ hourStarted │  │
│     │ c. Check daily limit → schedule next day nếu đạt    │  │
│     │ d. Check hourly limit → schedule next hour nếu đạt  │  │
│     │ e. Send emails với delay giữa mỗi email             │  │
│     │ f. Update counters sau mỗi email                    │  │
│     └─────────────────────────────────────────────────────┘  │
│                                                              │
│  5. Reschedule logic:                                        │
│     - Còn recipients + hit limit → schedule delayed job      │
│     - Còn recipients + no limit → schedule immediate job     │
│     - Không còn recipients → mark completed                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. Rate Limiting Logic

#### Daily Limit Check

```typescript
if (account.sentToday >= providerConfig.dailyLimit) {
  // Tính thời gian còn lại đến khi reset (24h từ lastResetDate)
  const msUntilNextDay = getMsUntilNextDay(account.lastResetDate);

  // Schedule job sau msUntilNextDay milliseconds
  scheduleNextJob(msUntilNextDay, 'daily_limit');
}
```

#### Hourly Limit Check

```typescript
if (account.sentThisHour >= providerConfig.maxPerHour) {
  // Tính thời gian còn lại đến giờ tiếp theo (60min từ hourStartedAt)
  const msUntilNextHour = getMsUntilNextHour(account.hourStartedAt);

  // Schedule job sau msUntilNextHour milliseconds
  scheduleNextJob(msUntilNextHour, 'hourly_limit');
}
```

#### Reset Logic

```typescript
// Reset daily (24h passed)
shouldResetDaily(account): boolean {
  const hoursSinceReset = (now - lastResetDate) / (1000 * 60 * 60);
  return hoursSinceReset >= 24;
}

// Reset hourly (60min passed)
shouldResetHourly(account): boolean {
  const minutesSinceStart = (now - hourStartedAt) / (1000 * 60);
  return minutesSinceStart >= 60;
}
```

---

## Ví Dụ Thực Tế

### Scenario: Gửi 1000 emails với 1 Gmail account

**Config Gmail:**
- dailyLimit: 500
- maxPerHour: 100
- delayBetweenEmails: 3000ms

**Timeline:**

```
Giờ 0 (00:00):
├── Gửi 100 emails (với delay 3s mỗi email)
├── Tổng thời gian: ~5 phút
├── sentThisHour = 100, sentToday = 100
└── Hit hourly limit → Schedule job sau 55 phút

Giờ 1 (01:00):
├── Reset sentThisHour = 0
├── Gửi 100 emails
├── sentThisHour = 100, sentToday = 200
└── Hit hourly limit → Schedule job sau 55 phút

Giờ 2 (02:00):
├── Reset sentThisHour = 0
├── Gửi 100 emails
├── sentThisHour = 100, sentToday = 300
└── Hit hourly limit → Schedule job sau 55 phút

Giờ 3 (03:00):
├── Reset sentThisHour = 0
├── Gửi 100 emails
├── sentThisHour = 100, sentToday = 400
└── Hit hourly limit → Schedule job sau 55 phút

Giờ 4 (04:00):
├── Reset sentThisHour = 0
├── Gửi 100 emails
├── sentThisHour = 100, sentToday = 500
└── Hit DAILY limit → Schedule job sau 20 giờ

Giờ 24 (Ngày hôm sau 00:00):
├── Reset sentToday = 0, sentThisHour = 0
├── Gửi 100 emails
└── ... tiếp tục cho đến khi hoàn thành

Tổng thời gian để gửi 1000 emails: ~2 ngày
```

### Scenario: Gửi 500 emails với 2 Gmail accounts

**Với 2 accounts, mỗi account gửi 250 emails:**

```
Giờ 0:
├── Account 1: Gửi 100 emails → Hit hourly
├── Account 2: Gửi 100 emails → Hit hourly
└── Tổng: 200 emails, Schedule sau 55 phút

Giờ 1:
├── Account 1: Gửi 100 emails → Hit hourly
├── Account 2: Gửi 100 emails → Hit hourly
└── Tổng: 400 emails, Schedule sau 55 phút

Giờ 2:
├── Account 1: Gửi 50 emails → Done
├── Account 2: Gửi 50 emails → Done
└── Tổng: 500 emails → Campaign COMPLETED!

Tổng thời gian: ~2.5 giờ (thay vì 5 giờ với 1 account)
```

---

## Self-Scheduling Mechanism

Queue tự động schedule job tiếp theo mà không cần cron:

```typescript
// Khi hit limit
await this.campaignEmailQueue.add(
  'campaign-email-sending-scheduled',
  { campaignId },
  {
    delay: rescheduleDelayMs,  // Delay tính toán dựa trên limit
    jobId: `campaign-${id}-scheduled-${Date.now()}`,
  },
);

// Khi còn recipients nhưng chưa hit limit
await this.campaignEmailQueue.add(
  'campaign-email-sending-continue',
  { campaignId },
  {
    delay: 1000,  // 1 second delay
    jobId: `campaign-${id}-continue-${Date.now()}`,
  },
);
```

---

## Trạng thái Campaign

| Status    | Mô tả                                    |
|-----------|------------------------------------------|
| draft     | Chưa bắt đầu                             |
| scheduled | Đã lên lịch (chưa đến giờ)               |
| running   | Đang chạy (có thể đang chờ rate limit)   |
| paused    | Tạm dừng bởi user                        |
| completed | Hoàn thành tất cả recipients             |
| failed    | Lỗi nghiêm trọng                         |

---

## Monitoring

Logs được ghi chi tiết:

```
[CampaignEmailConsumer] Processing campaign abc-123
[CampaignEmailConsumer] Found 500 pending recipients to send
[CampaignEmailConsumer] Reset hourly counter for account user@gmail.com
[CampaignEmailConsumer] Account user@gmail.com: can send 100 emails (daily: 0/500, hourly: 0/100)
[CampaignEmailConsumer] Sent email to recipient1@example.com via user@gmail.com
...
[CampaignEmailConsumer] Account user@gmail.com hit hourly limit during batch. Will resume in 55 minutes
[CampaignEmailConsumer] Scheduling next job for campaign abc-123 in 55 minutes (reason: hourly_limit)
[CampaignEmailConsumer] Campaign abc-123: sent 100, failed 0, remaining 400
```

---

## Lưu ý quan trọng

1. **Không cần cron job bên ngoài** - Queue tự quản lý scheduling
2. **Counters được persist** - Restart server không mất tracking
3. **Multiple accounts** - Tự động phân phối recipients
4. **Provider-specific limits** - Tự động detect dựa trên email domain
5. **Graceful handling** - Nếu 1 account hit limit, các account khác vẫn tiếp tục
