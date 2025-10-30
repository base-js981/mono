import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { EmailService } from './email.service';
import { EmailJobData } from './types/email-job.types';

@Processor('email')
export class EmailProcessor {
  constructor(private readonly emailService: EmailService) {}

  @Process('send-verification')
  async handleVerificationEmail(job: Job<EmailJobData>): Promise<void> {
    const { to, token, name } = job.data;
    
    try {
      await this.emailService.sendVerificationEmail(to, token, name);
      console.log(`Verification email sent successfully to ${to}`);
    } catch (error) {
      console.error(`Failed to send verification email to ${to}:`, error);
      throw error;
    }
  }
}

