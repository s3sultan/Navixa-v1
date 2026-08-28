# NAVIXA Emergency Mode / Plan B

Status: approved foundation, implementation isolated from current product paths.

## Goal
Keep Plus subscribers informed and able to reach a fallback experience when the primary NAVIXA service is unavailable, without making the fallback depend on the failed primary origin.

## Approved flow
1. Independent monitor checks primary service health.
2. Incident state moves through `healthy`, `degraded`, `outage`, `security-hold`, `recovery`.
3. Ordinary outage requires repeated confirmation before activation.
4. Security suspicion enters `security-hold`; automatic subscriber redirect/notification is blocked until stronger verification or manual admin activation.
5. Active Plus subscribers receive one incident-start notification through email and the official NAVIXA Telegram alert channel when available.
6. Message points to the Plan B entry point: `https://navixa.s2shug.chatgpt.site` only after platform access constraints are verified.
7. Plan B verifies entitlement using the subscriber's NAVIXA email against an independently synchronized, minimal entitlement snapshot. It must not require a second NAVIXA account.
8. When primary service is stable again, incident moves to `recovery`, then `healthy`, and one recovery notification is sent.
9. Admin has manual activate/deactivate controls as a fallback to automation.

## Safety boundaries
- Payment remains disabled and is outside this work.
- Never copy full subscriber records to the fallback. Minimum entitlement data only, encrypted/signed as appropriate.
- Never expose provider secrets, Telegram tokens, email API keys, session tokens, or payment data to the fallback client.
- Prefer short-lived signed access grants over a permanently open shared URL.
- Do not assume `chatgpt.site` can remove ChatGPT-account requirements. Verify that capability before wiring subscriber traffic to it.
- Monitoring and entitlement verification must use infrastructure independent enough to remain available when the primary NAVIXA origin is down.
- Deduplicate notifications per incident: one start notification and one recovery notification unless an administrator explicitly sends an update.

## Phase 1 foundation
- Keep existing production UI and billing untouched.
- Reuse the official Telegram sender and existing email provider only through server-side code.
- Add incident state storage and audit history in an isolated module.
- Add protected admin API for manual incident transitions.
- Add tests before wiring any automatic external notification.

## Phase 2 after platform verification
- Independent external health monitor.
- Minimal Plus entitlement synchronization.
- Plan B login/access grant.
- Automated email + Telegram fan-out.
- Recovery notification and periodic non-disruptive drill.
