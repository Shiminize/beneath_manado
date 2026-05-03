# Pocket Reader Analytics Setup

The app now serves book text through Vercel Functions and stores analytics in Postgres when these Vercel environment variables are configured.

## Required Vercel Variables

- `DATABASE_URL`: Neon/Postgres connection string.
- `SESSION_SECRET`: long random value used to sign owner and book-access cookies.
- `ANALYTICS_HASH_SECRET`: long random value used to hash visitor IP/user-agent data by day.
- `ADMIN_PASSWORD_HASH`: Argon2id hash for the owner analytics password.
- `ANALYTICS_RETENTION_DAYS`: optional raw-event retention window; default is `90`.

## Generate A Password Hash

Run:

```bash
npm run hash:password -- "replace-with-a-strong-password"
```

Copy the printed Argon2id hash into `ADMIN_PASSWORD_HASH`.

## Production Notes

- Full IP addresses are not stored. The server stores a masked network and a daily HMAC visitor hash.
- Book passwords are stored only as Argon2id hashes.
- The first API request creates the analytics tables and seeds the current packaged books.
- Without `DATABASE_URL`, public book reading still works through the server seed, but analytics and book lock settings are not persistent.
