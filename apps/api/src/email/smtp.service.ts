import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

export interface SmtpMail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);

  private transporters = new Map<string, Transporter>();

  async send(config: SmtpConfig, mail: SmtpMail): Promise<{ id: string }> {
    const cacheKey = `${config.host}:${config.port}:${config.user}`;
    let transporter = this.transporters.get(cacheKey);

    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.password },
        ...(config.port !== 465 ? { requireTLS: true } : {}),
      });
      this.transporters.set(cacheKey, transporter);
    }

    try {
      const info = await transporter.sendMail({
        from: mail.from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });

      this.logger.log(`Email sent via SMTP — messageId: ${info.messageId}`);
      return { id: info.messageId };
    }
  }
}
