import app from './app';
import { config } from './config/env';
import { prisma } from './config/db';
import { emailWorkerService } from './queues/emailWorker';
import { emailQueue, processDirectJob } from './queues/emailQueue';
import { redisConnection } from './config/redis';
import { elasticsearchService } from './services/elasticsearchService';

async function reconcilePendingJobsOnStartup(): Promise<void> {
  try {
    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'DELAYED'] },
      },
    });

    console.log(`[RestartRecovery] Found ${pendingJobs.length} scheduled/delayed jobs in database.`);

    for (const job of pendingJobs) {
      const delay = Math.max(0, job.scheduledAt.getTime() - Date.now());

      if (redisConnection.status === 'ready') {
        const bullJob = await emailQueue.getJob(job.jobId || job.id).catch(() => null);
        if (!bullJob) {
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
              delay,
              jobId: job.id,
            }
          );
          await prisma.emailJob.update({
            where: { id: job.id },
            data: { jobId: newBullJob.id },
          });
          console.log(`[RestartRecovery] Re-queued BullMQ job ${job.id} with delay: ${delay}ms`);
        }
      } else {
        // Redis offline -> use direct timer scheduler
        console.log(`[RestartRecovery] Re-scheduling DB job ${job.id} in ${delay}ms`);
        setTimeout(() => {
          processDirectJob(job.id).catch(console.error);
        }, delay);
      }
    }
  } catch (err: any) {
    console.warn('[RestartRecovery] Notice:', err.message);
  }
}

async function bootstrap() {
  try {
    console.log('----------------------------------------------------');
    console.log('🚀 Starting ReachInbox Full-Stack Email Job Scheduler');
    console.log('----------------------------------------------------');

    await prisma.$connect();
    console.log('[Database] Connected to database via Prisma.');

    await elasticsearchService.init();

    emailWorkerService.start();

    await reconcilePendingJobsOnStartup();

    const server = app.listen(config.port, () => {
      console.log(`[Server] Backend HTTP server running on port ${config.port}`);
      console.log(`[Bull-Board] Live BullMQ dashboard: http://localhost:${config.port}/admin/queues`);
      console.log(`[API Health] http://localhost:${config.port}/api/health`);
    });

    const shutdown = async () => {
      console.log('\n[Server] Gracefully shutting down...');
      server.close();
      await emailWorkerService.close();
      await emailQueue.close();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err: any) {
    console.error('[Bootstrap] Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
