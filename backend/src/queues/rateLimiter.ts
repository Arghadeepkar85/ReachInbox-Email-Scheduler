import { redisConnection } from '../config/redis';
import { prisma } from '../config/db';
import { config } from '../config/env';
import { slackService } from '../services/slackService';

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterMs?: number;
  nextWindow?: Date;
  currentCount?: number;
  limit?: number;
}

class RateLimiter {
  private lastSendMap = new Map<string, number>();

  /**
   * Returns the start timestamp of the current hour window (e.g. 2026-11-24 12:00:00.000)
   */
  public getCurrentHourWindow(): { windowStart: number; windowEnd: number } {
    const now = new Date();
    const windowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      0,
      0,
      0
    ).getTime();
    const windowEnd = windowStart + 3600 * 1000;
    return { windowStart, windowEnd };
  }

  /**
   * Checks whether the sender can send an email right now based on hourly rate limits.
   * Uses atomic Redis counter when Redis is active, or DB-backed count when Redis is offline.
   */
  public async checkAndConsume(sender: string, customLimit?: number): Promise<RateLimitCheckResult> {
    const limit = customLimit || config.worker.maxEmailsPerHourPerSender;
    const { windowStart, windowEnd } = this.getCurrentHourWindow();
    const rateKey = `email:rate:${sender}:${windowStart}`;

    let currentCount = 0;

    if (redisConnection.status === 'ready') {
      try {
        currentCount = await redisConnection.incr(rateKey);
        if (currentCount === 1) {
          await redisConnection.expire(rateKey, 7200);
        }
      } catch (e) {
        currentCount = 0;
      }
    }

    // Fallback: If Redis was not ready or failed, count directly from database
    if (currentCount === 0) {
      const sentCountInWindow = await prisma.emailJob.count({
        where: {
          sender,
          status: 'SENT',
          sentAt: { gte: new Date(windowStart) },
        },
      });
      currentCount = sentCountInWindow + 1;
    }

    if (currentCount > limit) {
      const now = Date.now();
      const timeUntilNextHour = Math.max(windowEnd - now, 1000);
      const jitter = Math.floor(Math.random() * 500);
      const retryAfterMs = timeUntilNextHour + jitter;
      const nextWindow = new Date(now + retryAfterMs);

      // Check if Slack notified already
      const alertLockKey = `email:slack_alerted:${sender}:${windowStart}`;
      let hasAlerted = false;

      if (redisConnection.status === 'ready') {
        try {
          const val = await redisConnection.get(alertLockKey);
          hasAlerted = !!val;
          if (!hasAlerted) {
            await redisConnection.set(alertLockKey, '1', 'EX', 7200);
          }
        } catch (e) {
          // ignore
        }
      }

      if (!hasAlerted) {
        console.warn(
          `[RateLimiter] Limit exceeded for ${sender}. (${currentCount}/${limit}). Rescheduling to ${nextWindow.toISOString()}`
        );

        await prisma.rateLimitEvent.create({
          data: {
            sender,
            limit,
            currentCount,
            rescheduledTo: nextWindow,
            slackNotified: true,
          },
        }).catch((err) => console.error('[RateLimiter] DB log error:', err.message));

        await slackService.notifyRateLimitHit({
          sender,
          limit,
          currentCount,
          rescheduledTo: nextWindow,
        });
      }

      return {
        allowed: false,
        retryAfterMs,
        nextWindow,
        currentCount,
        limit,
      };
    }

    return {
      allowed: true,
      currentCount,
      limit,
    };
  }

  /**
   * Enforces minimum delay between individual email sends for a given sender
   */
  public async enforceMinDelay(sender: string, minDelayMs?: number): Promise<void> {
    const delay = minDelayMs || config.worker.minDelayBetweenEmailsMs;
    const key = `email:last_send:${sender}`;

    let lastSendTime: number | null = null;

    if (redisConnection.status === 'ready') {
      try {
        const lastSendStr = await redisConnection.get(key);
        if (lastSendStr) lastSendTime = parseInt(lastSendStr, 10);
      } catch (e) {
        // ignore
      }
    }

    if (lastSendTime === null && this.lastSendMap.has(sender)) {
      lastSendTime = this.lastSendMap.get(sender)!;
    }

    if (lastSendTime) {
      const elapsed = Date.now() - lastSendTime;
      if (elapsed < delay) {
        const sleepTime = delay - elapsed;
        console.log(`[RateLimiter] Throttling send for ${sender}: sleeping ${sleepTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
      }
    }
  }

  /**
   * Updates last sent timestamp in Redis & Memory for a sender
   */
  public async recordSend(sender: string): Promise<void> {
    this.lastSendMap.set(sender, Date.now());
    if (redisConnection.status === 'ready') {
      try {
        const key = `email:last_send:${sender}`;
        await redisConnection.set(key, Date.now().toString(), 'EX', 86400);
      } catch (e) {
        // ignore
      }
    }
  }
}

export const rateLimiter = new RateLimiter();
