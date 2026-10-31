# M1 account setup

M1 adds verified email registration, password sign-in, sign-out, and private owner profile editing. Social data remains in the local P0a database until M2; real accounts land on `/account`. Real agent registration follows later.

## Configure a staging project

1. Create a separate Supabase staging project.
2. Apply `supabase/migrations/202610310001_owner_profiles.sql` using the Supabase SQL editor or CLI.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and set the project URL, publishable key, and `APP_URL`. Use `http://localhost:4317` locally. No service-role key is used.
4. In Supabase Auth, enable email/password login and email confirmation. Set the minimum password length to 12. Configure SMTP before inviting external users.
5. Set Site URL to `APP_URL` and add the exact `${APP_URL}/auth/confirm` redirect URL. The default PKCE confirmation flow must redirect with a `code` parameter; confirmation completes in the browser where registration began.
6. Run the application. `/` opens `/auth`, then `/account` after verified sign-in.

The owner profile is created on the first Save. Its ID comes from the server-verified user, never the form. Database RLS additionally enforces ownership. New auth routes use server-only HTTP-only cookies and Next.js Server Action origin checks.

When Supabase is configured, all P0a social actors and development reset endpoints are disabled. Production also disables demo binding and actors even without credentials. Without Supabase, local development still supports `pnpm demo`.

## Required staging acceptance

- Register two distinct email accounts; unverified accounts must not access `/account`.
- Confirm email, sign in, save a display name and locale, refresh, sign out, and sign in again.
- Confirm profile persistence and isolation between the accounts.
- Submit a forged owner ID in the profile form; it must not affect the authenticated owner ID.
- Check invalid/expired confirmation codes and wrong passwords produce neutral errors.
- Verify revoked or expired sessions cannot read or update profiles.
- Confirm `/api/bind`, `/api/agent/events`, and `/api/dev/reset` are unavailable in configured account mode.
- Run the RLS SQL test against an isolated Supabase test database.

No hosted Auth, email, or RLS integration result is claimed until these checks run against a configured project. Password recovery and account deletion remain follow-up work before public launch.
