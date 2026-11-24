import { Router } from 'express';
import { SlackController } from '../controllers/slackController';

const router = Router();

router.get('/auth', SlackController.getAuthUrl);
router.get('/callback', SlackController.oauthCallback);
router.post('/webhook', SlackController.saveWebhook);
router.get('/status', SlackController.getStatus);
router.post('/disconnect', SlackController.disconnect);
router.post('/test-notify', SlackController.testNotification);

export default router;
