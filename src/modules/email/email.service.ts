import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'localhost');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 1025);
    const smtpUser = this.configService.get<string>('SMTP_USER', '');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD', '');
    const smtpFrom = this.configService.get<string>('SMTP_FROM', 'noreply@example.com');

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      auth: smtpUser && smtpPassword ? {
        user: smtpUser,
        pass: smtpPassword,
      } : undefined,
    });
  }

  async sendVerificationEmail(email: string, token: string, name?: string): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const verificationUrl = `${appUrl}/auth/verify-email?token=${token}`;

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM', 'noreply@example.com'),
      to: email,
      subject: 'Xác nhận email đăng ký',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Xác nhận Email</h1>
            </div>
            <div class="content">
              <p>Xin chào${name ? ` ${name}` : ''},</p>
              <p>Cảm ơn bạn đã đăng ký. Vui lòng xác nhận email của bạn bằng cách nhấp vào nút bên dưới:</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Xác nhận Email</a>
              </p>
              <p>Hoặc copy và paste link sau vào trình duyệt:</p>
              <p style="word-break: break-all; color: #4f46e5;">${verificationUrl}</p>
              <p>Link này sẽ hết hạn sau 24 giờ.</p>
              <p>Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Base NodeJS. Tất cả quyền được bảo lưu.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Xin chào${name ? ` ${name}` : ''},

Cảm ơn bạn đã đăng ký. Vui lòng xác nhận email của bạn bằng cách truy cập link sau:

${verificationUrl}

Link này sẽ hết hạn sau 24 giờ.

Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}

