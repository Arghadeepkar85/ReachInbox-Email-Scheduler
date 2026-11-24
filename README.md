# ReachInbox – Full-Stack Production-Grade Email Job Scheduler & Dashboard

A production-grade, distributed asynchronous email campaign scheduler and real-time dashboard built for **ReachInbox / Outbox Labs**. Built with **TypeScript**, **Express.js**, **BullMQ** backed by **Redis**, **Prisma ORM** (PostgreSQL / SQLite), **Elasticsearch**, **Nodemailer / Ethereal SMTP**, **Slack Webhook & OAuth Integration**, and a modern **React + Vite + Tailwind CSS** frontend matching the ReachInbox Figma UI.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
   - [How Scheduling Works](#how-scheduling-works)
   - [How Persistence on Restart is Handled](#how-persistence-on-restart-is-handled)
   - [How Rate Limiting, Throttling and Concurrency Work](#how-rate-limiting-throttling-and-concurrency-work)
   - [Delay Between Each Email](#delay-between-each-email)
   - [Behavior Under Load](#behavior-under-load)
   - [Elasticsearch Full-Text Search](#elasticsearch-full-text-search)
   - [Slack Notification on Rate Limit Hit](#slack-notification-on-rate-limit-hit)
2. [Feature Mapping Matrix](#feature-mapping-matrix)
3. [Prerequisites and Tech Stack](#prerequisites-and-tech-stack)
4. [How to Set Up Ethereal Email and Env Variables](#how-to-set-up-ethereal-email-and-env-variables)
5. [How to Run Backend and Infrastructure](#how-to-run-backend-and-infrastructure)
   - [Running Infrastructure with Docker Compose](#running-infrastructure-with-docker-compose)
   - [Running the Backend Server](#running-the-backend-server)
6. [How to Run Frontend Dashboard](#how-to-run-frontend-dashboard)
7. [Live BullMQ Dashboard](#live-bullmq-dashboard)
8. [Demo Video Walkthrough Script](#demo-video-walkthrough-script)
9. [Assumptions, Shortcuts and Trade-offs](#assumptions-shortcuts-and-trade-offs)
10. [Submission Guidelines and Access](#submission-guidelines-and-access)

---

<a id="architecture-overview" name="architecture-overview"></a>
## <span id="architecture-overview">Architecture Overview</span>

```
                                  +---------------------------------------+
                                  |    React + Tailwind Frontend Client   |
                                  |     (Google OAuth, Compose, Tables)   |
                                  +-------------------+-------------------+
                                                      |
                                             REST API | /api/emails/*
                                                      v
                                  +---------------------------------------+
                                  |     Express.js + TypeScript Backend   |
                                  +---+--------------+-----------------+--+
                                      |              |                 |
       1. Persist State & Idempotency |              | 2. Enqueue      | 3. Index Doc
                                      v              v                 v
                 +------------------------+  +-----------------+  +-----------------+
                 |  Relational Database   |  |  BullMQ (Redis) |  |  Elasticsearch  |
                 |  (PostgreSQL / SQLite) |  |  Delayed Queue  |  |  Cluster (9200) |
                 +------------------------+  +--------+--------+  +-----------------+
                                                      |
                                                      | Pop delayed job
                                                      v
                                      +-------------------------------+
                                      |     BullMQ Worker Process     |
                                      |   (Configurable Concurrency)  |
                                      +---+---------------+-------+---+
                                          |               |       |
                 +------------------------+               |       +------------------------+
                 | Rate Limiting Check                    | Throttling (2s delay)          |
                 v                                        v                                v
+----------------------------------+          +-----------------------+       +-------------------------+
| Sliding Hour Bucket in Redis     |          | Enforce Provider Delay|       | Send Mail via Ethereal  |
| (email:rate:{sender}:{hour})     |          | (email:last_send)     |       | (Generate Preview Link) |
+----------------+-----------------+          +-----------------------+       +------------+------------+
                 |                                                                         |
                 | Exceeded Limit?                                                         v
                 v                                                            +-------------------------+
+----------------------------------+                                          | Mark SENT in DB &       |
| 1. Auto-reschedule to Next Hour  |                                          | Update Elasticsearch    |
| 2. Live HTTP Post to Slack       |                                          +-------------------------+
+----------------------------------+
```

<a id="how-scheduling-works" name="how-scheduling-works"></a>
### <span id="how-scheduling-works">How Scheduling Works</span>
* **Strictly No Cron Jobs**: Complies 100% with non-negotiable hard constraints: no OS-level cron (`crontab`) and no Node cron libraries (`node-cron`, `agenda`, etc.).
* **BullMQ Delayed Jobs**: When emails are scheduled:
  1. Target execution timestamp is calculated: `targetTime = startTime + (index * delayMs)`.
  2. Delay duration is computed: `delay = Math.max(0, targetTime.getTime() - Date.now())`.
  3. The job is created in the database (`EmailJob` record) with status `SCHEDULED`.
  4. The job is placed on the BullMQ queue (`email-queue`) with options: `{ delay, jobId: emailRecord.id }`.
  5. The `jobId` set directly to the database primary key guarantees **strict idempotency**—BullMQ will reject duplicate enqueue attempts.
* **Dual-Mode Queue Dispatcher**:
  - When Redis is running: BullMQ delayed queue processes the jobs with atomic distributed locks.
  - When Redis is offline or recovering: Seamlessly transitions to the custom database-backed delayed scheduler (using precise Node event loop delayed timers without cron), guaranteeing emails are dispatched even without Redis running.

<a id="how-persistence-on-restart-is-handled" name="how-persistence-on-restart-is-handled"></a>
### <span id="how-persistence-on-restart-is-handled">How Persistence on Restart is Handled</span>
* **Redis Sorted Set Persistence**: BullMQ stores all delayed jobs in Redis sorted sets (`zset`) with the scheduled execution timestamp as the score. If the backend process crashes or is restarted, Redis retains all jobs. Upon reboot, BullMQ workers resume reading delayed jobs without losing state.
* **Database Startup State Reconciliation**:
  - During backend bootstrap in `server.ts`, `reconcilePendingJobsOnStartup()` queries all `SCHEDULED` and `DELAYED` rows in the database.
  - It inspects BullMQ to verify each job is actively tracked. If any job was orphaned during a crash, it is re-queued with its remaining delay `Math.max(0, job.scheduledAt.getTime() - Date.now())`.
* **Idempotency Protection**:
  - Before sending, the worker checks if `emailRecord.status === 'SENT'`.
  - If already marked `SENT`, processing aborts immediately. Emails are never re-sent or restarted from Day 1.

<a id="how-rate-limiting-throttling-and-concurrency-work" name="how-rate-limiting-throttling-and-concurrency-work"></a>
### <span id="how-rate-limiting-throttling-and-concurrency-work">How Rate Limiting, Throttling and Concurrency Work</span>
* **Worker Concurrency**:
  - Configurable via `WORKER_CONCURRENCY` in `.env` (default: `5`).
  - BullMQ workers process multiple jobs concurrently with atomic job locking, preventing race conditions.
* **Hourly Rate Limiting**:
  - Enforces limit per sender identity via `MAX_EMAILS_PER_HOUR_PER_SENDER` (default: `200` emails/hour).
  - Uses atomic Redis counters keyed by `email:rate:{sender}:{hour_window_start}` with an automated 2-hour TTL.
  - If Redis is offline, it counts sent emails directly from the database for the current hour window (`status = 'SENT' AND sentAt >= windowStart`).
  - **Zero Dropped Jobs**: When the hourly threshold is reached, jobs are **never dropped or failed**. The system calculates the remaining time in the current hour window (`windowEnd - Date.now() + jitter`), updates the database status to `DELAYED`, and reschedules the job in BullMQ to execute at the start of the next hour window, preserving FIFO order.

<a id="delay-between-each-email" name="delay-between-each-email"></a>
### <span id="delay-between-each-email">Delay Between Each Email</span>
* **Chosen Delay**: Minimum **2 seconds** (`2000ms`) between individual email sends for the same sender identity (configurable via `DEFAULT_MIN_DELAY_BETWEEN_EMAILS_MS` or adjusted per campaign in the compose modal).
* **Why 2 Seconds**: Real-world SMTP providers (SES, SendGrid, Mailgun) enforce provider-level rate throttling. Spacing sends by a minimum of 2 seconds prevents connection resets, avoids IP reputation penalties, and mimics real-world outreach systems.
* **Enforcement**: Tracked in Redis using key `email:last_send:{sender}`. If an email is dequeued before 2 seconds have elapsed since the sender's previous email, the worker sleeps for the remaining milliseconds before sending.

<a id="behavior-under-load" name="behavior-under-load"></a>
### <span id="behavior-under-load">Behavior Under Load</span>
When 1,000+ emails are scheduled for roughly the same time:
1. **Batch Ingestion**:
   - The API receives the batch of 1,000 leads and persists them in the database with status `SCHEDULED`.
   - The jobs are added to BullMQ with incremental stagger delays (`i * delayMs`), ensuring the queue is not overwhelmed in a single tick.
2. **Worker Concurrency & Pacing**:
   - BullMQ workers pick up jobs up to the concurrency limit (e.g. 5 parallel workers).
   - Each worker checks `rateLimiter.enforceMinDelay()`, ensuring emails are throttled to 1 email every 2 seconds per sender.
3. **Hourly Rate Limit Reached**:
   - Once the sender reaches their hourly quota (e.g. 200 emails in the hour), `rateLimiter.checkAndConsume()` returns `allowed: false`.
   - The remaining 800 emails are **not failed or dropped**. They are rescheduled to the beginning of the next hour window (`windowEnd + jitter`), preserving original campaign order.
4. **Single Slack Alert on Quota Hit**:
   - An atomic Redis lock (`email:slack_alerted:{sender}:{hourWindow}`) ensures only **one** live Slack alert is dispatched per sender per hour window, preventing Slack notification floods while keeping the team alerted.

<a id="elasticsearch-full-text-search" name="elasticsearch-full-text-search"></a>
### <span id="elasticsearch-full-text-search">Elasticsearch Full-Text Search</span>
* All scheduled, delayed, and sent emails are automatically indexed into the `emails` Elasticsearch index with mappings for `recipient`, `subject`, `body`, `sender`, and `status`.
* The frontend search bar queries `GET /api/emails/search?q=...` which executes a multi-match fuzzy query.
* **Graceful Degradation**: If Elasticsearch is offline, the backend seamlessly falls back to database ILIKE/contains queries without errors.

<a id="slack-notification-on-rate-limit-hit" name="slack-notification-on-rate-limit-hit"></a>
### <span id="slack-notification-on-rate-limit-hit">Slack Notification on Rate Limit Hit</span>
* **Real OAuth & Webhook Integration**:
  - Users can click **"Connect Slack"** in the top navigation bar to trigger an OAuth authorization flow or configure an Incoming Webhook URL.
  - The webhook/bot token is stored in the database.
* **Live Verifiable Notification**: The moment a sender exceeds their hourly limit, the rate limiter fires a live HTTP POST call to Slack with formatted Block Kit cards showing the sender address, current sent count, hourly threshold, and rescheduled next window.
* **Disconnect/Reconnect Safety**: If Slack is not connected, the rate limiter suppresses notifications without crashing or delaying email processing. When reconnected, notifications resume immediately without requiring a restart or redeployment.

---

<a id="feature-mapping-matrix" name="feature-mapping-matrix"></a>
## <span id="feature-mapping-matrix">Feature Mapping Matrix</span>

| PDF Requirement | Backend Implementation | Frontend UI Implementation |
|---|---|---|
| **Accept email send requests via API** | `POST /api/emails/schedule` with Zod validation | Compose modal with subject, body, sender |
| **Store in relational DB** | Prisma ORM with SQLite / PostgreSQL models | Tables with sorting, status badges, timestamps |
| **BullMQ delayed jobs (No cron)** | `emailQueue.add('send-email', ..., { delay })` | Visualized live on BullMQ Board (`/admin/queues`) |
| **Ethereal fake SMTP** | Nodemailer with automatic test account creation | "View Email" button opening Ethereal inspector URL |
| **Server restart persistence** | Redis persistence + startup DB reconciliation | Preserved jobs reload seamlessly in tables |
| **Worker Concurrency** | Configurable via `WORKER_CONCURRENCY` | Handled across BullMQ concurrent workers |
| **Delay between emails** | Redis `email:last_send` + worker sleep (2s) | Configurable delay slider/input in compose |
| **Hourly rate limiting** | Redis `email:rate:{sender}:{hour}` sliding bucket | Status badge: `Throttled / Rescheduled` |
| **Slack notifications** | `slackService.notifyRateLimitHit` via webhook/OAuth | "Connect Slack" button + live test trigger modal |
| **Elasticsearch search** | `@elastic/elasticsearch` indexing & fuzzy search | Real-time search bar filtering across all tabs |
| **Google OAuth Login** | `google-auth-library` verification + profile sync | Google Sign-in button + 1-click login options |
| **CSV/TXT Lead Upload** | `POST /api/emails/upload-leads` & regex parser | Drag-and-drop file upload with detected email count |
| **Scheduled & Sent Tables** | Filtered DB queries with pagination & sorting | Dark theme tables, loading states, empty states |

---

<a id="prerequisites-and-tech-stack" name="prerequisites-and-tech-stack"></a>
## <span id="prerequisites-and-tech-stack">Prerequisites and Tech Stack</span>

* **Node.js**: v18.0.0 or higher (v20+ recommended)
* **npm**: v9+
* **Docker & Docker Compose** (for PostgreSQL, Redis, Elasticsearch)

---

<a id="how-to-set-up-ethereal-email-and-env-variables" name="how-to-set-up-ethereal-email-and-env-variables"></a>
## <span id="how-to-set-up-ethereal-email-and-env-variables">How to Set Up Ethereal Email and Env Variables</span>

### Ethereal Email Setup
1. **Automatic Zero-Config Setup (Default)**:
   - If `ETHEREAL_USER` and `ETHEREAL_PASS` are left empty in `.env`, the backend automatically calls `nodemailer.createTestAccount()` on boot.
   - It prints the generated test account to the console and generates live preview links for every sent email.
2. **Custom Account Setup**:
   - Go to [https://ethereal.email/create](https://ethereal.email/create) to generate permanent test credentials.
   - Paste the username and password into `backend/.env`:
     ```env
     ETHEREAL_USER=your_ethereal_user@ethereal.email
     ETHEREAL_PASS=your_ethereal_password
     ```

### Environment Variables
Copy `.env.example` files to `.env` in both folders:

**Backend (`backend/.env`):**
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="file:./dev.db"

# Redis Config (used by BullMQ & Rate Limiter)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Worker & Rate Limiting Options
WORKER_CONCURRENCY=5
DEFAULT_MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=200

# Elasticsearch Config
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=emails

# Slack Integration (OAuth or Direct Webhook)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

# Google OAuth
GOOGLE_CLIENT_ID=

# Ethereal Email (Auto-generated if left blank)
ETHEREAL_USER=
ETHEREAL_PASS=

# Frontend Origin
FRONTEND_URL=http://localhost:3000
```

**Frontend (`frontend/.env`):**
```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

---

<a id="how-to-run-backend-and-infrastructure" name="how-to-run-backend-and-infrastructure"></a>
## <span id="how-to-run-backend-and-infrastructure">How to Run Backend and Infrastructure</span>

<a id="running-infrastructure-with-docker-compose" name="running-infrastructure-with-docker-compose"></a>
### <span id="running-infrastructure-with-docker-compose">Running Infrastructure with Docker Compose</span>
To start Redis, PostgreSQL, and Elasticsearch:
```bash
docker compose up -d
```
Services exposed:
* **Redis**: `localhost:6379`
* **PostgreSQL**: `localhost:5432` (`reachinbox` / `password123`)
* **Elasticsearch**: `localhost:9200`

<a id="running-the-backend-server" name="running-the-backend-server"></a>
### <span id="running-the-backend-server">Running the Backend Server</span>
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```
* Backend API: `http://localhost:5000`
* BullMQ Dashboard: `http://localhost:5000/admin/queues`

---

<a id="how-to-run-frontend-dashboard" name="how-to-run-frontend-dashboard"></a>
## <span id="how-to-run-frontend-dashboard">How to Run Frontend Dashboard</span>

```bash
cd frontend
npm install
npm run dev
```
* Dashboard URL: `http://localhost:3000`

---

<a id="live-bullmq-dashboard" name="live-bullmq-dashboard"></a>
## <span id="live-bullmq-dashboard">Live BullMQ Dashboard</span>
Visit **`http://localhost:5000/admin/queues`** to view real-time queue states:
* **Active**: Jobs currently executing in worker threads.
* **Delayed**: Jobs scheduled for future delivery with countdown timers.
* **Completed**: Sent emails with return metadata.
* **Failed**: Errored jobs with stack traces and retry counts.

---

<a id="demo-video-walkthrough-script" name="demo-video-walkthrough-script"></a>
## <span id="demo-video-walkthrough-script">Demo Video Walkthrough Script</span>

1. **Sign In**:
   - Open `http://localhost:3000`.
   - Click Google Login (or click "Sign In as Arghadeep" / "Sign In as Evaluator" for immediate preview).
   - Verify header shows user avatar, name, and email.
2. **Connect Slack**:
   - Click "Connect Slack" in the top bar.
   - Enter your Slack Incoming Webhook URL and click "Save".
   - Click "Dispatch Live Test Alert" to verify real notification delivery in Slack.
3. **Upload Leads via CSV**:
   - Click "Compose New Email".
   - Upload the provided `leads.csv` file.
   - Note the real-time indicator: *"6 recipients detected & loaded"*.
   - Enter subject: `Welcome to ReachInbox`.
   - Enter body: `<p>Excited to have you onboard!</p>`.
   - Set delay to 2 seconds and click "Schedule Campaign".
4. **View Scheduled Queue**:
   - Switch to "Scheduled Emails" tab.
   - Watch the emails progress through the queue.
5. **View Sent Emails & Ethereal Previews**:
   - Switch to "Sent Emails" tab.
   - Click the "View Email" button next to any sent email to open the live Ethereal test inbox and inspect the rendered email.
6. **Simulate Server Restart Persistence**:
   - Schedule 5 emails set for 2 minutes in the future.
   - Stop the backend server (`Ctrl + C`).
   - Start the backend server again (`npm run dev`).
   - Verify that BullMQ reloads all delayed jobs, does not duplicate previous emails, and delivers them exactly on schedule!
7. **Simulate Rate Limit Throttling Under Load**:
   - Set hourly limit to 2 emails/hour in the composer.
   - Send 5 emails.
   - The first 2 emails will be sent immediately; emails 3–5 will be throttled and marked `Throttled / Rescheduled` to the next hour window.
   - Verify that a live alert is instantly sent to your connected Slack channel!

---

<a id="assumptions-shortcuts-and-trade-offs" name="assumptions-shortcuts-and-trade-offs"></a>
## <span id="assumptions-shortcuts-and-trade-offs">Assumptions, Shortcuts and Trade-offs</span>

1. **Dual Queue Dispatcher (BullMQ + DB Delayed Scheduler)**: While BullMQ + Redis is the primary engine, if Redis is temporarily offline during local review, the backend automatically uses the database delayed scheduler so reviewers can evaluate the system without mandatory Docker setup.
2. **Ethereal Auto-Creation**: Enabled automatic ephemeral account generation via `nodemailer.createTestAccount()` so anyone running the project can immediately view sent emails without creating an account first.
3. **Dual Slack Integration**: Both Slack OAuth 2.0 authorization and direct Incoming Webhooks are supported, enabling testing with or without a Slack Developer App.
4. **Per-Sender Rate Limiting**: Limit counters are isolated by sender address (`email:rate:{sender}:{hour}`), allowing multiple team members to send campaigns simultaneously without impacting each other's rate limits.
5. **Zero Job Loss**: Under rate-limit spikes or provider throttling, jobs are postponed to the next valid window with minor jitter rather than rejected.

---

<a id="submission-guidelines-and-access" name="submission-guidelines-and-access"></a>
## <span id="submission-guidelines-and-access">Submission Guidelines and Access</span>

Per assignment instructions:
* **Private Repository Collaborators Granted Access**:
  - **`Mitrajit`**
  - **`Yadav036`**
* **ClickUp Assignment Submission Form**: [https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST](https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST)
