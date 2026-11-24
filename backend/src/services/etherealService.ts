import nodemailer from 'nodemailer';
import { config } from '../config/env';

interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendMailResult {
  messageId: string;
  etherealUrl: string | false;
}

class EtherealService {
  private transporter: nodemailer.Transporter | null = null;
  private isInitializing: Promise<void> | null = null;

  private async initializeTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;

    if (this.isInitializing) {
      await this.isInitializing;
      if (this.transporter) return this.transporter;
    }

    this.isInitializing = (async () => {
      let user = config.ethereal.user;
      let pass = config.ethereal.pass;

      if (!user || !pass) {
        console.log('[Ethereal] No explicit credentials provided. Generating new Ethereal test account...');
        const testAccount = await nodemailer.createTestAccount();
        user = testAccount.user;
        pass = testAccount.pass;
        console.log(`[Ethereal] Test account generated! User: ${user}`);
      }

      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user,
          pass,
        },
      });

      console.log('[Ethereal] SMTP Transporter ready.');
    })();

    await this.isInitializing;
    return this.transporter!;
  }

  public async sendEmail(options: SendMailOptions): Promise<SendMailResult> {
    const transporter = await this.initializeTransporter();

    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text || options.html?.replace(/<[^>]+>/g, ''),
      html: options.html || options.text,
    });

    const etherealUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[Ethereal] Message sent to ${options.to}. Preview URL: ${etherealUrl}`);

    return {
      messageId: info.messageId,
      etherealUrl,
    };
  }
}

export const etherealService = new EtherealService();
