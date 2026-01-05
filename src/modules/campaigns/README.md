  Tổng quan hệ thống

  1. Files đã tạo/cập nhật:

  Constant:
  - src/constant/campaigns.ts - Queue name constant

  Consumer:
  - src/modules/campaigns/campaigns.consumer.ts - Xử lý gửi email tự động

  Module & Service:
  - src/modules/campaigns/campaigns.module.ts - Đăng ký BullMQ queue
  - src/modules/campaigns/campaigns.service.ts - Thêm logic scheduling

  2. Cách hoạt động:

  Khi start campaign:
  POST /campaigns/:id/start
  - Campaign status chuyển sang RUNNING
  - Tạo repeatable job chạy mỗi ngày lúc 01:00 UTC (08:00 sáng giờ VN)
  - Job ID: campaign-{id} để tránh duplicate

  Logic gửi email hàng ngày:
  1. Tính daily limit: số accounts × 300 emails
    - Ví dụ: 2 accounts = 600 emails/ngày
  2. Lấy pending recipients: Lấy tối đa số lượng daily limit, sắp xếp theo thời gian tạo
  3. Phân chia đều cho accounts:
    - Nếu có 600 emails và 2 accounts → mỗi account gửi 300 emails
    - Round-robin distribution
  4. Gửi email với delay:
    - Sử dụng delayBetweenEmails từ campaign config
    - Replace variables: {{name}}, {{email}}, {{category}}, {{address}}
  5. Update status:
    - Thành công → sent, cập nhật sentAt
    - Thất bại → failed, lưu errorMessage, tăng retryCount
  6. Kiểm tra hoàn thành:
    - Nếu không còn pending recipients → status = completed
    - Tự động remove repeatable job

  Khi pause campaign:
  POST /campaigns/:id/pause
  - Campaign status chuyển sang PAUSED
  - Remove repeatable job (ngừng gửi hàng ngày)

  Khi resume campaign:
  POST /campaigns/:id/resume
  - Campaign status chuyển lại RUNNING
  - Tạo lại repeatable job

  Khi delete campaign:
  DELETE /campaigns/:id
  - Remove repeatable job
  - Xóa campaign

  3. Thống kê được tracking:

  - totalSent - Tổng số emails đã gửi
  - totalFailed - Tổng số emails thất bại
  - totalRecipients - Tổng số recipients
  - startedAt - Thời gian bắt đầu
  - completedAt - Thời gian hoàn thành

  4. Ví dụ flow:

  Day 1 - 08:00 AM:
  - Campaign có 1000 recipients, 2 accounts
  - Gửi 600 emails (300/account)
  - Còn lại: 400 pending

  Day 2 - 08:00 AM:
  - Gửi 400 emails còn lại
  - Campaign status → completed
  - Auto remove job

  Hệ thống sẽ tự động chạy mỗi ngày vào 01:00 UTC cho đến khi gửi xong tất cả emails!