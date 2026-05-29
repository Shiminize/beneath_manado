# Pocket Reader Analytics Setup

The app now serves book text through Vercel Functions and stores analytics in Postgres when these Vercel environment variables are configured.

## Required Vercel Variables

- `DATABASE_URL`: Neon/Postgres connection string.
- `SESSION_SECRET`: long random value used to sign owner and book-access cookies.
- `ANALYTICS_HASH_SECRET`: long random value used to hash visitor IP/user-agent data by day.
- `ADMIN_PASSWORD_HASH`: Argon2id hash for the owner analytics password.
- `BOOK_PASSWORD_ENCRYPTION_KEY`: 32-byte base64url, base64, or hex key used to encrypt the admin-only password display copy for newly set book passwords.
- `ANALYTICS_RETENTION_DAYS`: optional raw-event retention window; default is `90`.

## Generate A Password Hash

Run:

```bash
npm run hash:password -- "replace-with-a-strong-password"
```

Copy the printed Argon2id hash into `ADMIN_PASSWORD_HASH`.

## Generate A Book Password Display Key

Run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Copy the printed value into `BOOK_PASSWORD_ENCRYPTION_KEY`.

## Production Notes

- Full IP addresses are not stored. The server stores a masked network and a daily HMAC visitor hash.
- Reading behavior is stored as per-book reading sessions, not raw page-turn rows. Older page-view rows are aggregated into reading sessions and then removed by the analytics migration.
- Reader unlocks use Argon2id password hashes. The admin dashboard can also show newly set/reset book passwords by storing a separate encrypted display copy with `BOOK_PASSWORD_ENCRYPTION_KEY`.
- Existing hash-only book passwords cannot be recovered; reset the book password once to make it visible in the admin dashboard going forward.
- The first API request creates the analytics tables and seeds the current packaged books.
- Without `DATABASE_URL`, public book reading still works through the server seed, but analytics and book lock settings are not persistent.
