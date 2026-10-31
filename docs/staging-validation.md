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

Completed user-assisted browser acceptance in Safari:

- Hosted Auth recorded successful signup and confirmation email delivery. Attempting sign-in before confirmation returned `email_not_confirmed`; repeated signup returned a mail-send rate limit. Both now have explicit UI feedback and regression tests.
- The user completed email confirmation and sign-in; the server-verified `/account` page rendered successfully.
- Saved the temporary display name `Yuhan · M1 verification`; the page returned `message=saved` and the value survived a full refresh.
- Restored the original display name `Yuhan` and saved it successfully.
- Signed out, then directly opened `/account`; the browser returned to `/auth` without displaying private profile data.
- The user entered their password and signed in again. `/account` rendered the same profile with display name `Yuhan` and locale `zh-Hans`.

M1 registration, sign-in, owner profile persistence, sign-out, and subsequent sign-in acceptance is complete. Password recovery, account deletion, production SMTP, and the production social-data migration remain later work before public launch. These results do not claim that the entire product is ready for public registration.
