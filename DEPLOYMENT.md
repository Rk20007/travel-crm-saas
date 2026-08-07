# Deployment — AWS EC2 + Nginx (Next.js 16 SaaS CRM)

This app is a **Next.js App Router + MongoDB** multi-tenant travel CRM scaffold. Deploy it like any Node SSR app behind Nginx, with MongoDB Atlas (or EC2-hosted MongoDB) and optionally Redis.

## Recommended folder highlights

```
app/api/              REST routes (auth, leads, follow-ups, brands, cron, uploads, whatsapp stubs)
models/               Mongoose models (Lead, FollowUp, Team/workspace, Brand, …)
lib/                  auth, mongo, tenant scopes, Bull queue helpers, Redis rate-limit, plans
scripts/              optional Bull worker (follow-up reminders)
```

## Prerequisites

1. Node.js 22+ (matching your dev machine toolchain).
2. MongoDB reachable from the EC2 security group (`MONGODB_URI`).
3. (Optional but recommended for prod) Redis for Bull queues + distributed rate limiting.
4. Long random values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `CRON_SECRET`.

## Build on the server

```bash
git clone <repository-url> travel-crm-saas
cd travel-crm-saas
cp .env.local.example .env.local
nano .env.local   # populate secrets + Mongo + Redis URLs
npm ci
npm run build
```

Run in production mode:

```bash
NODE_ENV=production PORT=3000 npm run start
```

(Optional) Dedicated Bull worker for queued tasks:

```bash
REDIS_URL=redis://127.0.0.6379 npm run worker:followups
```

## Systemd units (sketch)

**`/etc/systemd/system/travel-crm.service`**

```
[Unit]
Description=Travel CRM Next.js app
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/travel-crm-saas
EnvironmentFile=/opt/travel-crm-saas/.env.local
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=always

[Install]
WantedBy=multi-user.target
```

Reload + enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now travel-crm.service
```

## Nginx reverse proxy (`/etc/nginx/sites-available/travel-crm`)

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/travel-crm /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Use **certbot** (Let’s Encrypt) for TLS.

## Operational hooks

| Endpoint | Purpose |
| --- | --- |
| `POST /api/cron/reminders` | Header `x-cron-secret: $CRON_SECRET` — enqueue in-app reminders for imminent follow-ups. |
| `POST /api/public/leads` | `x-api-key` header — ingest leads for workspaces with inbound API keys (Standard+ plans). Mint key from `/dashboard/admin`. |

Configure **cron** (`crontab -e`) to hit the reminders route every hour.

## Scaling notes

- Keep MongoDB backups + indexes on `{ teamId, brandId }` hot paths (`Lead`, timeline, dashboards).
- Add WebSocket gateways (already depend on `socket.io`/`ws`) via a standalone Node adapter if horizontal scaling Next beyond one instance.
- For presigned uploads, add `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (see `/api/upload/presign`).
- Razorpay/Stripe connectors should reuse `models/Payment.js` statuses (`pending`, `partial`, `completed`, …).

## Security checklist before launch

1. Rotate all placeholder secrets (`JWT_*`, SMTP, Razorpay, AWS).
2. Block public write access — only `/api/public/leads` with rotating API keys plus plan gating.
3. Prefer MongoDB IAM / IP allowlist on Atlas.
4. Enable structured logging forwarding (extend `lib/logger.js`).

This gets you production-shaped hosting; SaaS metering, metering webhooks, and provider-specific WhatsApp payloads still need tenant-specific QA.
