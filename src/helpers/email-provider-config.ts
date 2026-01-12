// emailProviderConfig.ts
export const EMAIL_PROVIDER_CONFIGS = {
  'gmail.com': {
    name: 'Gmail',
    dailyLimit: 500,
    delayBetweenEmails: 3000, // 3 giây
    maxPerHour: 100,
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
    },
  },
  'outlook.com': {
    name: 'Outlook',
    dailyLimit: 300,
    delayBetweenEmails: 4000, // 4 giây
    maxPerHour: 60,
    smtp: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
    },
  },
  'hotmail.com': {
    name: 'Hotmail',
    dailyLimit: 300,
    delayBetweenEmails: 4000,
    maxPerHour: 60,
    smtp: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
    },
  },
  'yahoo.com': {
    name: 'Yahoo',
    dailyLimit: 500,
    delayBetweenEmails: 5000, // 5 giây
    maxPerHour: 80,
    smtp: {
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false,
    },
  },
  custom: {
    name: 'Custom SMTP',
    dailyLimit: 1000,
    delayBetweenEmails: 2000, // 2 giây
    maxPerHour: 200,
    smtp: {
      // Người dùng tự config
    },
  },
};

export function getProviderConfig(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  return EMAIL_PROVIDER_CONFIGS[domain] || EMAIL_PROVIDER_CONFIGS['custom'];
}
