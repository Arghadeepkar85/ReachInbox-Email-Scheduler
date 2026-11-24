import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { emailQueueManager } from '../queues/emailQueue';
import { elasticsearchService } from '../services/elasticsearchService';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export class EmailController {
  /**
   * Schedule one or more emails
   */
  public static async scheduleEmails(req: Request, res: Response): Promise<void> {
    try {
      const {
        recipients,
        sender = 'outreach@reachinbox.ai',
        subject,
        body,
        startTime,
        delayMs = 2000,
        hourlyLimit = 200,
      } = req.body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({ error: 'Recipients must be a non-empty array of email addresses.' });
        return;
      }

      if (!subject || !body) {
        res.status(400).json({ error: 'Subject and Body are required.' });
        return;
      }

      const scheduledDate = startTime ? new Date(startTime) : new Date();
      if (isNaN(scheduledDate.getTime())) {
        res.status(400).json({ error: 'Invalid startTime provided.' });
        return;
      }

      // Filter and clean valid recipient emails
      const validRecipients = recipients
        .map((r: string) => (typeof r === 'string' ? r.trim().toLowerCase() : ''))
        .filter((r: string) => EMAIL_REGEX.test(r));

      if (validRecipients.length === 0) {
        res.status(400).json({ error: 'No valid recipient email addresses found.' });
        return;
      }

      const jobsToSchedule = validRecipients.map((recipient) => ({
        sender,
        recipient,
        subject,
        body,
        scheduledAt: scheduledDate,
        delayMs: Number(delayMs) || 2000,
        hourlyLimit: Number(hourlyLimit) || 200,
      }));

      const scheduledJobs = await emailQueueManager.scheduleJobs(jobsToSchedule);

      res.status(201).json({
        success: true,
        message: `Successfully scheduled ${scheduledJobs.length} email(s).`,
        count: scheduledJobs.length,
        jobs: scheduledJobs,
      });
    } catch (err: any) {
      console.error('[EmailController] Error scheduling emails:', err);
      res.status(500).json({ error: 'Failed to schedule emails', details: err.message });
    }
  }

  /**
   * Parse CSV or TXT file or raw text to extract email leads
   */
  public static async uploadLeads(req: Request, res: Response): Promise<void> {
    try {
      let fileContent = '';

      if (req.file) {
        fileContent = req.file.buffer.toString('utf-8');
      } else if (req.body.content) {
        fileContent = req.body.content;
      } else {
        res.status(400).json({ error: 'No file or content provided.' });
        return;
      }

      // Extract all email patterns from file text
      const extractedEmails = fileContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const uniqueEmails = Array.from(new Set(extractedEmails.map((e) => e.toLowerCase())));

      res.json({
        success: true,
        count: uniqueEmails.length,
        emails: uniqueEmails,
      });
    } catch (err: any) {
      console.error('[EmailController] Error uploading leads:', err);
      res.status(500).json({ error: 'Failed to parse leads', details: err.message });
    }
  }

  /**
   * Get all scheduled or delayed emails
   */
  public static async getScheduledEmails(req: Request, res: Response): Promise<void> {
    try {
      const scheduledEmails = await prisma.emailJob.findMany({
        where: {
          status: { in: ['SCHEDULED', 'DELAYED', 'PROCESSING'] },
        },
        orderBy: { scheduledAt: 'asc' },
      });

      res.json({ success: true, count: scheduledEmails.length, data: scheduledEmails });
    } catch (err: any) {
      console.error('[EmailController] Error fetching scheduled emails:', err);
      res.status(500).json({ error: 'Failed to fetch scheduled emails', details: err.message });
    }
  }

  /**
   * Get all sent or failed emails
   */
  public static async getSentEmails(req: Request, res: Response): Promise<void> {
    try {
      const sentEmails = await prisma.emailJob.findMany({
        where: {
          status: { in: ['SENT', 'FAILED'] },
        },
        orderBy: { updatedAt: 'desc' },
      });

      res.json({ success: true, count: sentEmails.length, data: sentEmails });
    } catch (err: any) {
      console.error('[EmailController] Error fetching sent emails:', err);
      res.status(500).json({ error: 'Failed to fetch sent emails', details: err.message });
    }
  }

  /**
   * Search emails via Elasticsearch with SQL database fallback
   */
  public static async searchEmails(req: Request, res: Response): Promise<void> {
    try {
      const query = (req.query.q as string || '').trim();
      const statusFilter = req.query.status as string;

      if (!query) {
        res.json({ success: true, count: 0, data: [] });
        return;
      }

      // 1. Try Elasticsearch
      const esMatchIds = await elasticsearchService.searchEmails(query);

      let results;
      if (esMatchIds !== null) {
        console.log(`[Search] Found ${esMatchIds.length} hits from Elasticsearch`);
        results = await prisma.emailJob.findMany({
          where: {
            id: { in: esMatchIds },
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        });
      } else {
        // Fallback to DB
        console.log('[Search] Executing database fallback search');
        results = await prisma.emailJob.findMany({
          where: {
            OR: [
              { recipient: { contains: query } },
              { subject: { contains: query } },
              { body: { contains: query } },
              { sender: { contains: query } },
            ],
            ...(statusFilter ? { status: statusFilter } : {}),
          },
          orderBy: { updatedAt: 'desc' },
        });
      }

      res.json({ success: true, count: results.length, data: results });
    } catch (err: any) {
      console.error('[EmailController] Error searching emails:', err);
      res.status(500).json({ error: 'Failed to search emails', details: err.message });
    }
  }

  /**
   * System overview statistics
   */
  public static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const [total, scheduled, delayed, sent, failed] = await Promise.all([
        prisma.emailJob.count(),
        prisma.emailJob.count({ where: { status: 'SCHEDULED' } }),
        prisma.emailJob.count({ where: { status: 'DELAYED' } }),
        prisma.emailJob.count({ where: { status: 'SENT' } }),
        prisma.emailJob.count({ where: { status: 'FAILED' } }),
      ]);

      const activeSenders = await prisma.emailJob.groupBy({
        by: ['sender'],
        _count: { sender: true },
      });

      res.json({
        success: true,
        data: {
          total,
          scheduled: scheduled + delayed,
          sent,
          failed,
          activeSendersCount: activeSenders.length,
          senders: activeSenders.map((s) => ({ sender: s.sender, count: s._count.sender })),
        },
      });
    } catch (err: any) {
      console.error('[EmailController] Error fetching stats:', err);
      res.status(500).json({ error: 'Failed to fetch statistics', details: err.message });
    }
  }

  /**
   * Cancel a scheduled email
   */
  public static async cancelEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await emailQueueManager.cancelJob(id);

      if (!success) {
        res.status(404).json({ error: 'Email job not found or already completed.' });
        return;
      }

      res.json({ success: true, message: 'Email job successfully cancelled.' });
    } catch (err: any) {
      console.error('[EmailController] Error cancelling email:', err);
      res.status(500).json({ error: 'Failed to cancel email', details: err.message });
    }
  }
}
