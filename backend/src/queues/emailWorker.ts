import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { prisma } from '../config/db';
import { config } from '../config/env';
import { EMAIL_QUEUE_NAME, EmailJobPayload, emailQueueManager } from './emailQueue';
import { rateLimiter } from './rateLimiter';
import { etherealService } from '../services/etherealService';
import { elasticsearchService } from '../services/elasticsearchService';

export class EmailWorkerService {
  private worker: Worker<EmailJobPayload> | null = null;

  public start(): Worker<EmailJobPayload> {
    if (this.worker) return this.worker;

    console.log(
      `[EmailWorker] Initializing BullMQ worker with concurrency: ${config.worker.concurrency}`
    );

    this.worker = new Worker<EmailJobPayload>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobPayload>) => {
        const { emailJobId, sender, recipient, subject, body, hourlyLimit, delayMs } = job.data;

        console.log(`[EmailWorker] Processing job ${job.id} for recipient: ${recipient}`);

        // 1. Fetch DB record and verify idempotency
        const emailRecord = await prisma.emailJob.findUnique({
          where: { id: emailJobId },
        });

        if (!emailRecord) {
          console.warn(`[EmailWorker] Email job record ${emailJobId} not found in DB. Skipping.`);
          return { skipped: true, reason: 'Record not found' };
        }

        if (emailRecord.status === 'SENT') {
          console.log(`[EmailWorker] Email ${emailJobId} has already been sent. Idempotency enforced.`);
          return { skipped: true, reason: 'Already sent' };
        }

        // 2. Check Rate Limit (Atomic Redis counter per sender per hour window)
        const rateCheck = await rateLimiter.checkAndConsume(sender, hourlyLimit);

        if (!rateCheck.allowed) {
          console.log(
            `[EmailWorker] Rate limit exceeded for sender ${sender}. Rescheduling to ${rateCheck.nextWindow?.toISOString()}`
          );

          // Gracefully reschedule into next hour window without dropping or failing the job
          await emailQueueManager.rescheduleJob(
            emailJobId,
            rateCheck.nextWindow || new Date(Date.now() + 3600000),
            rateCheck.retryAfterMs || 3600000
          );

          return {
            status: 'rescheduled',
            rescheduledTo: rateCheck.nextWindow,
            reason: 'Hourly rate limit exceeded',
          };
        }

        // 3. Enforce minimum delay between sends to mimic provider throttling
        await rateLimiter.enforceMinDelay(sender, delayMs);

        // 4. Update status to PROCESSING in DB
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { status: 'PROCESSING' },
        });

        try {
          // 5. Send email via Ethereal SMTP
          const sendResult = await etherealService.sendEmail({
            from: sender,
            to: recipient,
            subject,
            html: body,
          });

          const now = new Date();
          const previewUrl = sendResult.etherealUrl || null;

          // 6. Update DB record to SENT
          const updatedRecord = await prisma.emailJob.update({
            where: { id: emailJobId },
            data: {
              status: 'SENT',
              sentAt: now,
              etherealPreviewUrl: previewUrl,
              errorMessage: null,
            },
          });

          // 7. Update Elasticsearch
          elasticsearchService.indexEmail({
            id: updatedRecord.id,
            jobId: job.id,
            sender: updatedRecord.sender,
            recipient: updatedRecord.recipient,
            subject: updatedRecord.subject,
            body: updatedRecord.body,
            status: 'SENT',
            scheduledAt: updatedRecord.scheduledAt.toISOString(),
            sentAt: now.toISOString(),
            createdAt: updatedRecord.createdAt.toISOString(),
          }).catch((err) => console.warn('[Elasticsearch] Error indexing sent email:', err.message));

          // 8. Record timestamp in Redis for minimum delay throttling
          await rateLimiter.recordSend(sender);

          console.log(`[EmailWorker] Email sent to ${recipient} successfully! Preview: ${previewUrl}`);
          return {
            status: 'SENT',
            messageId: sendResult.messageId,
            previewUrl,
          };
        } catch (err: any) {
          console.error(`[EmailWorker] Failed to send email to ${recipient}:`, err.message);

          // Update DB record to FAILED
          await prisma.emailJob.update({
            where: { id: emailJobId },
            data: {
              status: 'FAILED',
              errorMessage: err.message,
            },
          });

          throw err; // Let BullMQ handle retries if configured
        }
      },
      {
        connection: redisConnection,
        concurrency: config.worker.concurrency,
      }
    );

    this.worker.on('ready', () => {
      console.log('[EmailWorker] BullMQ worker is ready and listening for jobs.');
    });

    this.worker.on('completed', (job: Job) => {
      console.log(`[EmailWorker] Job ${job.id} completed.`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`[EmailWorker] Job ${job?.id} failed with error:`, err.message);
    });

    this.worker.on('error', (err: Error) => {
      console.warn('[EmailWorker] Worker error/warning:', err.message);
    });

    return this.worker;
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      console.log('[EmailWorker] BullMQ worker closed.');
    }
  }
}

export const emailWorkerService = new EmailWorkerService();
