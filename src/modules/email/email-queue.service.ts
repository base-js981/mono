import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EmailJobData } from './types/email-job.types';

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

  async sendVerificationEmail(email: string, token: string, name?: string): Promise<void> {
    await this.emailQueue.add(
      'send-verification',
      {
        type: 'verification',
        to: email,
        token,
        name,
      } as EmailJobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }
}

