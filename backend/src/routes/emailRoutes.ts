import { Router } from 'express';
import multer from 'multer';
import { EmailController } from '../controllers/emailController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.post('/schedule', EmailController.scheduleEmails);
router.post('/upload-leads', upload.single('file'), EmailController.uploadLeads);
router.get('/scheduled', EmailController.getScheduledEmails);
router.get('/sent', EmailController.getSentEmails);
router.get('/search', EmailController.searchEmails);
router.get('/stats', EmailController.getStats);
router.delete('/:id', EmailController.cancelEmail);

export default router;
