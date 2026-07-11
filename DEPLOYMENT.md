# Production deployment

1. Create a Supabase production project and run migrations in order.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`), and server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy to Vercel or another Node.js platform.
4. Configure `/api/health` for liveness and `/api/health/ready` for readiness monitoring.
5. Enable database backups, point-in-time recovery, log drains, rate limiting, and alerting.
6. Rotate secrets before launch and enforce MFA for administrators.
