# Deployment Guide

## Overview

This repository uses a workspace layout with:

- `backend/` Fastify + Prisma API service
- `frontend/` Next.js dashboard

Use managed hosting for each service:

- Frontend: Vercel
- Backend: Railway or Render

## Prerequisites

- Node.js 20+
- npm 10+
- A hosted Redis instance for queue/rate-limit features in production
- A managed database (Postgres recommended for scale; SQLite works for smaller deployments)

## Backend Deployment

### Build and start commands

- Build: `npm run build`
- Start: `npm run start`

### Required environment variables

- `NODE_ENV=production`
- `PORT=8080`
- `HOST=0.0.0.0`
- `CORS_ORIGIN=https://<your-frontend-domain>`
- `JWT_SECRET=<strong-random-secret>`
- `JWT_REFRESH_SECRET=<strong-random-secret>`
- `AI_PROVIDER=groq` or `openai`
- `GROQ_API_KEY=<key>` or `OPENAI_API_KEY=<key>`

### Recommended environment variables

- `REDIS_URL=<redis-url>`
- `MAX_INPUT_CHARS=2000`
- `MAX_RESPONSE_BYTES=524288`
- `AI_TIMEOUT_MS=25000`
- `AI_MAX_RETRIES=2`
- `SENTRY_DSN=<dsn>`

### Notes

- If using SQLite in production, mount persistent disk storage.
- For scaling and reliability, migrate Prisma datasource to Postgres.

## Frontend Deployment

### Build and start commands

- Build: `npm run build`
- Start: `npm run start`

### Required environment variables

- `NEXT_PUBLIC_API_BASE_URL=https://<your-backend-domain>`
- `NEXT_PUBLIC_API_VERSION=/api/v1`

## CI/CD Recommendations

- Run on every push:
  - `npm run typecheck -w backend`
  - `npm run test -w backend`
  - `npm run build -w backend`
  - `npm run build -w frontend`

## Smoke Test Checklist

After deployment, verify:

- `GET /api/v1/health` returns OK
- Auth register/login endpoints are reachable
- Chat message endpoint returns assistant reply
- Streaming endpoint emits token events
- Agent endpoint returns multi-agent stage output
- Frontend can send chat and receive stream output
