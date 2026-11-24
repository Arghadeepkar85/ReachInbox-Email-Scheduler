export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface EmailJob {
  id: string;
  jobId?: string | null;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DELAYED';
  scheduledAt: string;
  sentAt?: string | null;
  delayMs: number;
  hourlyLimit: number;
  errorMessage?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemStats {
  total: number;
  scheduled: number;
  sent: number;
  failed: number;
  activeSendersCount: number;
  senders: Array<{ sender: string; count: number }>;
}

export interface ScheduleEmailPayload {
  recipients: string[];
  sender: string;
  subject: string;
  body: string;
  startTime?: string;
  delayMs: number;
  hourlyLimit: number;
}
