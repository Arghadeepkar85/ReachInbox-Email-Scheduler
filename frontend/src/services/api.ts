import axios from 'axios';
import { EmailJob, ScheduleEmailPayload, SystemStats, User } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const emailApi = {
  getScheduledEmails: async (): Promise<EmailJob[]> => {
    const res = await api.get('/emails/scheduled');
    return res.data.data;
  },

  getSentEmails: async (): Promise<EmailJob[]> => {
    const res = await api.get('/emails/sent');
    return res.data.data;
  },

  searchEmails: async (q: string, status?: string): Promise<EmailJob[]> => {
    const res = await api.get('/emails/search', { params: { q, status } });
    return res.data.data;
  },

  getStats: async (): Promise<SystemStats> => {
    const res = await api.get('/emails/stats');
    return res.data.data;
  },

  scheduleEmails: async (payload: ScheduleEmailPayload) => {
    const res = await api.post('/emails/schedule', payload);
    return res.data;
  },

  uploadLeads: async (file: File): Promise<{ count: number; emails: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/emails/upload-leads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  cancelEmail: async (id: string): Promise<void> => {
    await api.delete(`/emails/${id}`);
  },
};

export const slackApi = {
  getAuthUrl: async (): Promise<string> => {
    const res = await api.get('/slack/auth');
    return res.data.url;
  },

  getStatus: async (): Promise<boolean> => {
    const res = await api.get('/slack/status');
    return res.data.connected;
  },

  saveWebhook: async (webhookUrl: string): Promise<void> => {
    await api.post('/slack/webhook', { webhookUrl });
  },

  disconnect: async (): Promise<void> => {
    await api.post('/slack/disconnect');
  },

  testNotification: async (sender?: string): Promise<void> => {
    await api.post('/slack/test-notify', { sender });
  },
};

export const authApi = {
  googleLogin: async (credential?: string, profile?: any): Promise<User> => {
    const res = await api.post('/auth/google', { credential, profile });
    return res.data.user;
  },
};

export default api;
