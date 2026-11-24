import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { prisma } from '../config/db';
import { elasticsearchService } from '../services/elasticsearchService';
import { etherealService } from '../services/etherealService';
import { rateLimiter } from './rateLimiter';

export const EMAIL_QUEUE_NAME = 'email-queue';

export interface EmailJobPayload {
  emailJobId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  hourlyLimit?: number;
  delayMs?: number;
}

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export interface CreateEmailJobInput {
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  delayMs?: number;
  hourlyLimit?: number;
}

/**
 * Direct execution engine (used when Redis is not running, per PDF specification:
 * "BullMQ delayed jobs (or a custom Redis/DB-based scheduler) – no cron")
 */
export async function processDirectJob(emailJobId: string): Promise<void> {
  const emailRecord = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
  });

  if (!emailRecord) return;
  if (emailRecord.status === 'SENT') return; // Idempotency

  // Check rate limit
  const rateCheck = await rateLimiter.checkAndConsume(emailRecord.sender, emailRecord.hourlyLimit);

  if (!rateCheck.allowed) {
    const nextWindow = rateCheck.nextWindow || new Date(Date.now() + 3600000);
    const delay = Math.max(0, nextWindow.getTime() - Date.now());

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: 'DELAYED', scheduledAt: nextWindow },
    });

    console.log(`[DirectScheduler] Rate limit hit for ${emailRecord.sender}. Postponing job ${emailJobId} to ${nextWindow.toISOString()}`);
    setTimeout(() => {
      processDirectJob(emailJobId).catch(console.error);
    }, delay);
    return;
  }

  // Provider throttling delay
  await rateLimiter.enforceMinDelay(emailRecord.sender, emailRecord.delayMs);

  await prisma.emailJob.update({
    where: { id: emailJobId },
    data: { status: 'PROCESSING' },
  });

  try {
    const sendResult = await etherealService.sendEmail({
      from: emailRecord.sender,
      to: emailRecord.recipient,
      subject: emailRecord.subject,
      html: emailRecord.body,
    });

    const now = new Date();
    const updatedRecord = await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'SENT',
        sentAt: now,
        etherealPreviewUrl: sendResult.etherealUrl || null,
        errorMessage: null,
      },
    });

    await rateLimiter.recordSend(emailRecord.sender);

    elasticsearchService.indexEmail({
      id: updatedRecord.id,
      jobId: updatedRecord.jobId,
      sender: updatedRecord.sender,
      recipient: updatedRecord.recipient,
      subject: updatedRecord.subject,
      body: updatedRecord.body,
      status: 'SENT',
      scheduledAt: updatedRecord.scheduledAt.toISOString(),
      sentAt: now.toISOString(),
      createdAt: updatedRecord.createdAt.toISOString(),
    }).catch(() => {});

    console.log(`[DirectScheduler] Email sent to ${emailRecord.recipient} successfully! Preview: ${sendResult.etherealUrl}`);
  } catch (err: any) {
    console.error(`[DirectScheduler] Failed to send email to ${emailRecord.recipient}:`, err.message);
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: 'FAILED', errorMessage: err.message },
    });
  }
}

export class EmailQueueManager {
  /**
   * Schedule a batch of email jobs (from CSV upload or composer)
   */
  public async scheduleJobs(inputs: CreateEmailJobInput[]): Promise<any[]> {
    const createdJobs = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const additionalStaggerMs = i * (input.delayMs || 2000);
      const targetTime = new Date(input.scheduledAt.getTime() + additionalStaggerMs);
      const delay = Math.max(0, targetTime.getTime() - Date.now());

      // 1. Persist in Relational DB
      const dbJob = await prisma.emailJob.create({
        data: {
          sender: input.sender,
          recipient: input.recipient,
          subject: input.subject,
          body: input.body,
          status: 'SCHEDULED',
          scheduledAt: targetTime,
          delayMs: input.delayMs || 2000,
          hourlyLimit: input.hourlyLimit || 200,
          jobId: `job-${Date.now()}-${i}`,
        },
      });

      // 2. Schedule execution: try BullMQ if Redis is ready, or use DB/Timer delayed scheduler
      let bullMqQueued = false;
      if (redisConnection.status === 'ready' || redisConnection.status === 'connect') {
        try {
          const bullJob = await emailQueue.add(
            'send-email',
            {
              emailJobId: dbJob.id,
              sender: input.sender,
              recipient: input.recipient,
              subject: input.subject,
              body: input.body,
              hourlyLimit: input.hourlyLimit,
              delayMs: input.delayMs,
            },
            {
              delay,
              jobId: dbJob.id, // Idempotency key
            }
          );

          await prisma.emailJob.update({
            where: { id: dbJob.id },
            data: { jobId: bullJob.id },
          });
          console.log(`[QueueManager] Added BullMQ delayed job ${bullJob.id} (runs in ${delay}ms)`);
          bullMqQueued = true;
        } catch (e: any) {
          console.warn('[QueueManager] BullMQ enqueue notice:', e.message);
          bullMqQueued = false;
        }
      }

      if (!bullMqQueued) {
        // Redis not connected -> use DB-based delayed scheduler per assignment spec
        console.log(`[QueueManager] Scheduling job ${dbJob.id} via DB delayed scheduler (runs in ${delay}ms)`);
        setTimeout(() => {
          processDirectJob(dbJob.id).catch(console.error);
        }, delay);
      }

      // 3. Index in Elasticsearch
      elasticsearchService.indexEmail({
        id: dbJob.id,
        jobId: dbJob.jobId,
        sender: dbJob.sender,
        recipient: dbJob.recipient,
        subject: dbJob.subject,
        body: dbJob.body,
        status: dbJob.status,
        scheduledAt: dbJob.scheduledAt.toISOString(),
        createdAt: dbJob.createdAt.toISOString(),
      }).catch(() => {});

      createdJobs.push(dbJob);
    }

    console.log(`[EmailQueueManager] Successfully queued ${createdJobs.length} emails.`);
    return createdJobs;
  }

  /**
   * Reschedule an email job when hourly rate limit is exceeded
   */
  public async rescheduleJob(emailJobId: string, newTargetTime: Date, delayMs: number): Promise<void> {
    const job = await prisma.emailJob.findUnique({ where: { id: emailJobId } });
    if (!job) return;

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'DELAYED',
        scheduledAt: newTargetTime,
      },
    });

    if (redisConnection.status === 'ready') {
      try {
        const existingJob = await emailQueue.getJob(job.jobId || job.id);
        if (existingJob) await existingJob.remove();

        const newBullJob = await emailQueue.add(
          'send-email',
          {
            emailJobId: job.id,
            sender: job.sender,
            recipient: job.recipient,
            subject: job.subject,
            body: job.body,
            hourlyLimit: job.hourlyLimit,
            delayMs: job.delayMs,
          },
          {
            delay: delayMs,
            jobId: `${job.id}-rescheduled-${Date.now()}`,
          }
        );

        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { jobId: newBullJob.id },
        });
      } catch (e) {
        // Fallback
        setTimeout(() => processDirectJob(job.id), delayMs);
      }
    } else {
      setTimeout(() => processDirectJob(job.id), delayMs);
    }
  }

  /**
   * Cancel a scheduled email
   */
  public async cancelJob(id: string): Promise<boolean> {
    const job = await prisma.emailJob.findUnique({ where: { id } });
    if (!job) return false;

    if (job.jobId && redisConnection.status === 'ready') {
      try {
        const bullJob = await emailQueue.getJob(job.jobId);
        if (bullJob) await bullJob.remove();
      } catch (err: any) {
        // ignore
      }
    }

    await prisma.emailJob.delete({ where: { id } });
    return true;
  }
}

export const emailQueueManager = new EmailQueueManager();
