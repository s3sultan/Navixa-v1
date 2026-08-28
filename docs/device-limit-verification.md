# NAVIXA device-session limit verification

This branch enforces at most one active `computer` session and one active `mobile` session per account.

- A new login on the same device class revokes the previous active session in that class.
- Computer and mobile sessions may remain active together.
- Device class prefers `Sec-CH-UA-Mobile` and falls back to a conservative user-agent check.
- Existing pre-migration sessions have an empty device class and are rejected by the updated session resolver, requiring one fresh login after rollout.
- Production deployment applies D1 migrations before the Worker deploy step.

Verification added in `tests/user-device-limits.test.ts` and included in the repository `npm test` command.
