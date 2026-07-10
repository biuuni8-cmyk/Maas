# Security policy

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Store API keys only as SHA-256 hashes; display plaintext once at creation.
- Rotate webhook secrets and API keys regularly.
- Use Supabase RLS for every tenant-owned table.
- Report vulnerabilities privately to the repository owner.
