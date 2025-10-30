import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EmailQueueService } from './email-queue.service';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [EmailService, EmailQueueService, EmailProcessor],
  exports: [EmailQueueService],
})
export class EmailModule {}

