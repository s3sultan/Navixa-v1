# NAVIXA Emergency Mode / Plan B

Status: approved foundation, implementation isolated from current product paths.

## Goal
Keep active هِمّة subscribers informed and able to reach a fallback experience when the primary NAVIXA service is unavailable, without making the fallback depend on the failed primary origin.

## Approved flow
1. Independent monitor checks primary service health.
2. Incident state moves through `healthy`, `degraded`, `outage`, `security-hold`, `recovery`.
3. Ordinary outage requires repeated confirmation before activation.
4. Security suspicion enters `security-hold`; automatic subscriber redirect/notification is blocked until stronger verification or manual admin activation.
5. Active هِمّة subscribers receive one incident-start notification through email and the official NAVIXA Telegram alert channel when available.
6. The notification contains a short-lived, incident-bound signed Plan B access grant, not a permanently open shared link.
7. The grant is delivered in the URL fragment (`#grant=...`) so it is not sent to the fallback server in the initial HTTP request, and the fallback removes it from the address bar after reading it.
8. Plan B verifies the signed grant using an independently provisioned signing secret. The grant contains no raw subscriber email and is bound to one incident with a short expiry.
9. Entitlement is derived from a minimal emergency snapshot containing only a keyed entitlement identifier and active-until timestamp. No display name, payment data, session token, OTP data, Telegram id, or raw email is copied into the snapshot.
10. When primary service is stable again, incident moves to `recovery`, then `healthy`, and one recovery notification is sent.
11. Admin retains manual activate/deactivate controls as a fallback to automation.

## Safety boundaries
- Payment remains disabled and is outside this work.
- Never copy full subscriber records to the fallback. Minimum entitlement data only, encrypted/signed as appropriate.
- Never expose provider secrets, Telegram tokens, email API keys, session tokens, payment data, entitlement secrets, or signing secrets to the fallback client.
- Only NAVIXA-controlled HTTPS fallback hosts under `navixasa.com` may be configured for production notifications.
- Outage notifications fail closed if `NAVIXA_PLAN_B_URL`, `NAVIXA_EMERGENCY_ENTITLEMENT_SECRET`, or `NAVIXA_PLAN_B_SIGNING_SECRET` are not ready.
- Monitoring and entitlement verification must use infrastructure independent enough to remain available when the primary NAVIXA origin is down.
- Deduplicate notifications per incident: one start notification and one recovery notification unless an administrator explicitly sends an update.

## Current foundation
- Existing production UI and billing remain untouched.
- Official Telegram and email delivery stay server-side only.
- Incident state storage and audit history are isolated.
- Admin API is protected and manual transitions remain available.
- Emergency notification delivery is deduplicated per incident/subscriber/channel.
- Signed Plan B grants are short-lived, incident-bound, and entitlement-gated.
- Fallback access fails closed when verification material is absent or invalid.

## Remaining before live activation
- Deploy the fallback on a genuinely independent host under the NAVIXA domain.
- Provision the same Plan B signing secret to the independent verifier without exposing it client-side.
- Synchronize the minimum entitlement snapshot independently of the primary outage path.
- Run an end-to-end drill: confirmed outage -> signed grant -> fallback verification -> recovery, without broad user notification.
- Keep automatic live activation disabled until the independent monitor and fallback dependencies are verified.
