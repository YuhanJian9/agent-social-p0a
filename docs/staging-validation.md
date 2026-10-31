# Staging validation — 2026-10-31

Project: `agent-social-staging` (`upwfoaoezesvkfdnurym`), separate from future production.

Completed against the hosted staging project:

- Site URL: `http://localhost:4317`.
- Allowed email confirmation redirect: `http://localhost:4317/auth/confirm`.
- Email provider, new signups, and email confirmation enabled.
- Minimum password length configured as 12.
- Owner profile migration applied in a transaction through the SQL editor.
- Database assertions passed: own-row visibility, correct owner identity, forged insert denial, cross-owner update denial, anonymous read denial. Temporary test users and profiles were rolled back.
- Local `.env.local` configured with project URL and publishable key; Git ignores the file. No service-role key used.
- Local auth page returns HTTP 200; legacy bind and agent event endpoints return HTTP 404 in configured mode.

Pending user-assisted acceptance:

- Real email signup and delivery.
- Confirmation callback in the registration browser.
- Login, profile creation/update/persistence, logout, and subsequent login.

The hosted database checks do not substitute for the pending browser/email checks. Keep M1 in draft until the latter are completed.
