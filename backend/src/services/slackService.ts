import axios from 'axios';
import { prisma } from '../config/db';
import { config } from '../config/env';

export interface SlackRateLimitNotification {
  sender: string;
  limit: number;
  currentCount: number;
  rescheduledTo: Date;
}

class SlackService {
  /**
   * Generates Slack OAuth authorization URL
   */
  public getAuthorizeUrl(state?: string): string {
    const scopes = ['incoming-webhook', 'chat:write'];
    return `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scopes.join(',')}&redirect_uri=${encodeURIComponent(config.slack.redirectUri)}${state ? `&state=${state}` : ''}`;
  }

  /**
   * Exchanges authorization code for bot token / webhook
   */
  public async exchangeCode(code: string): Promise<{ ok: boolean; webhookUrl?: string; accessToken?: string; error?: string }> {
    try {
      const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
        params: {
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          code,
          redirect_uri: config.slack.redirectUri,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.data.ok) {
        return { ok: false, error: response.data.error };
      }

      const webhookUrl = response.data.incoming_webhook?.url;
      const accessToken = response.data.access_token;

      return {
        ok: true,
        webhookUrl,
        accessToken,
      };
    } catch (err: any) {
      console.error('[Slack] OAuth exchange failed:', err.message);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Save Slack credentials for a user
   */
  public async saveSlackCredentials(userIdOrEmail: string, webhookUrl?: string, token?: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: userIdOrEmail }, { email: userIdOrEmail }],
      },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          slackWebhook: webhookUrl || null,
          slackToken: token || null,
        },
      });
      console.log(`[Slack] Saved Slack connection for user ${user.email}`);
    } else {
      // If user record doesn't exist yet, create or upsert
      await prisma.user.upsert({
        where: { email: userIdOrEmail },
        update: { slackWebhook: webhookUrl, slackToken: token },
        create: {
          email: userIdOrEmail,
          name: 'System Admin',
          slackWebhook: webhookUrl,
          slackToken: token,
        },
      });
      console.log(`[Slack] Created user and saved Slack connection for ${userIdOrEmail}`);
    }
  }

  /**
   * Check if any Slack integration is active
   */
  public async isSlackConnected(): Promise<boolean> {
    const userWithSlack = await prisma.user.findFirst({
      where: {
        OR: [
          { slackWebhook: { not: null } },
          { slackToken: { not: null } },
        ],
      },
    });

    return !!userWithSlack;
  }

  /**
   * Disconnect Slack
   */
  public async disconnectSlack(userIdOrEmail?: string): Promise<void> {
    if (userIdOrEmail) {
      await prisma.user.updateMany({
        where: {
          OR: [{ id: userIdOrEmail }, { email: userIdOrEmail }],
        },
        data: {
          slackWebhook: null,
          slackToken: null,
        },
      });
    } else {
      await prisma.user.updateMany({
        data: {
          slackWebhook: null,
          slackToken: null,
        },
      });
    }
    console.log('[Slack] Disconnected Slack integration');
  }

  /**
   * Sends real notification to Slack when rate limit is hit.
   * Dispatches live HTTP request to Slack webhook or chat API.
   * If not connected, does NOT crash.
   */
  public async notifyRateLimitHit(details: SlackRateLimitNotification): Promise<boolean> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { slackWebhook: { not: null } },
            { slackToken: { not: null } },
          ],
        },
      });

      if (!user || (!user.slackWebhook && !user.slackToken)) {
        console.log('[Slack] Rate limit hit, but Slack is not connected. Skipping notification.');
        return false;
      }

      const formattedNextRun = details.rescheduledTo.toLocaleString();
      const messagePayload = {
        text: `⚠️ *ReachInbox Email Throttling Alert: Hourly Rate Limit Reached*`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 Sender Hourly Rate Limit Exceeded',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender:*\n\`${details.sender}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Limit:*\n${details.limit} emails/hour`,
              },
              {
                type: 'mrkdwn',
                text: `*Current Count:*\n${details.currentCount} emails sent`,
              },
              {
                type: 'mrkdwn',
                text: `*Next Execution Window:*\n${formattedNextRun}`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'ℹ️ *Action taken:* All pending emails for this sender have been rescheduled to the next available hour window preserving original send order. No jobs were dropped.',
              },
            ],
          },
        ],
      };

      if (user.slackWebhook) {
        await axios.post(user.slackWebhook, messagePayload, { timeout: 8000 });
        console.log(`[Slack] Live rate limit notification sent via webhook for sender: ${details.sender}`);
        return true;
      }

      if (user.slackToken) {
        await axios.post(
          'https://slack.com/api/chat.postMessage',
          {
            channel: '#general',
            ...messagePayload,
          },
          {
            headers: { Authorization: `Bearer ${user.slackToken}` },
            timeout: 8000,
          }
        );
        console.log(`[Slack] Live rate limit notification sent via chat.postMessage for sender: ${details.sender}`);
        return true;
      }

      return false;
    } catch (err: any) {
      console.error('[Slack] Failed to send rate limit notification to Slack:', err.message);
      return false;
    }
  }
}

export const slackService = new SlackService();
