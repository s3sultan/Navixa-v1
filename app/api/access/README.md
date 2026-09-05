# Access API

Canonical public read endpoints for the launch access model:

- `/api/access/trial`: server-clock trial phase and remaining time.
- `/api/access/catalog`: approved Free/Azm/Himma capability model.
- `/api/access/entitlement`: capability evaluation helper. Do not use a client-provided plan as proof of a paid subscription in protected server actions; resolve the authenticated user's plan there.
- `/api/access/usage-limits`: current safe quota defaults.
- `/api/access/usage-limits/check`: quota arithmetic helper. Protected heavy-service routes must use trusted server-side usage counters, never a client-provided `used` value, before consuming paid AI/transcription resources.

The trial expires at `2026-09-12T16:00:00+03:00`. Reminder phase starts `2026-09-09T00:00:00+03:00`.
