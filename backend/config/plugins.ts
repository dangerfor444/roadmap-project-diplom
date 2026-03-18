import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const smtpPort = env.int('SMTP_PORT', 465);
  const smtpSecure = env.bool('SMTP_SECURE', true);

  return {
    email: {
      config: {
        provider: 'nodemailer',
        providerOptions: {
          host: env('SMTP_HOST', 'smtp.mail.ru'),
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: env('SMTP_USER', ''),
            pass: env('SMTP_PASS', ''),
          },
        },
        settings: {
          defaultFrom: env('EMAIL_DEFAULT_FROM', 'noreply@example.com'),
          defaultReplyTo: env('EMAIL_DEFAULT_REPLY_TO', 'noreply@example.com'),
        },
      },
    },
  };
};

export default config;
