import { Request, Response } from 'express';
import { slackService } from '../services/slackService';
import { config } from '../config/env';

export class SlackController {
  /**
   * Redirects user to Slack OAuth authorization page
   */
  public static async getAuthUrl(req: Request, res: Response): Promise<void> {
    const url = slackService.getAuthorizeUrl();
    res.json({ url });
  }

  /**
   * Handles Slack OAuth redirect callback
   */
  public static async oauthCallback(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
      console.error('[SlackController] OAuth error:', error);
      res.redirect(`${config.frontendUrl}?slack_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.redirect(`${config.frontendUrl}?slack_error=missing_code`);
      return;
    }

    const exchange = await slackService.exchangeCode(code);
    if (!exchange.ok) {
      res.redirect(`${config.frontendUrl}?slack_error=${encodeURIComponent(exchange.error || 'exchange_failed')}`);
      return;
    }

    // Save credentials to admin user
    await slackService.saveSlackCredentials('admin@reachinbox.ai', exchange.webhookUrl, exchange.accessToken);

    res.redirect(`${config.frontendUrl}?slack=connected`);
  }

  /**
   * Save incoming webhook URL directly (useful for local development or custom channels)
   */
  public static async saveWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookUrl, email = 'admin@reachinbox.ai' } = req.body;

      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        res.status(400).json({ error: 'Valid Slack webhook URL is required (starts with https://hooks.slack.com/).' });
        return;
      }

      await slackService.saveSlackCredentials(email, webhookUrl);
      res.json({ success: true, message: 'Slack incoming webhook connected successfully.' });
    } catch (err: any) {
      console.error('[SlackController] Error saving webhook:', err);
      res.status(500).json({ error: 'Failed to save Slack webhook', details: err.message });
    }
  }

  /**
   * Check connection status
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const isConnected = await slackService.isSlackConnected();
      res.json({ success: true, connected: isConnected });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to check Slack status', details: err.message });
    }
  }

  /**
   * Disconnect Slack
   */
  public static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      await slackService.disconnectSlack();
      res.json({ success: true, message: 'Slack disconnected successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to disconnect Slack', details: err.message });
    }
  }

  /**
   * Test Slack notification
   */
  public static async testNotification(req: Request, res: Response): Promise<void> {
    try {
      const { sender = 'demo-sender@reachinbox.ai' } = req.body;
      const sent = await slackService.notifyRateLimitHit({
        sender,
        limit: 200,
        currentCount: 201,
        rescheduledTo: new Date(Date.now() + 3600000),
      });

      if (!sent) {
        res.status(400).json({
          success: false,
          message: 'Slack notification was not sent. Ensure Slack is connected first.',
        });
        return;
      }

      res.json({ success: true, message: 'Test rate limit notification dispatched to Slack!' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to send test notification', details: err.message });
    }
  }
}
