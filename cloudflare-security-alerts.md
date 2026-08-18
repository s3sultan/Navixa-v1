# NAVIXA Cloudflare Security Monitoring

## Worker logs

Workers Logs is enabled by the deployment workflow with structured JSON events from `worker/index.ts`. Security events are always emitted for admin scopes and statuses 401, 403, 429, and 5xx. Public successful traffic is sampled.

Recommended dashboard filters:

- `path = /admin` or `path starts with /admin/` and `status >= 300`
- `status = 401 OR status = 403` for authentication probing
- `status = 429` for rate-limit pressure
- `status >= 500` for application or upstream errors
- `path contains /api/auth` with repeated failures
- `method = POST` on `/api/telegram-alert`, `/api/sync`, or `/api/stats`

Useful fields are `request_id`, `cf_ray`, `method`, `path`, `status`, `duration_ms`, and `auth`. Never log `Cookie`, JWT values, Authorization headers, email addresses, Telegram payloads, or sync payloads.

## Recommended alerts

Create Cloudflare Notifications or an external Logpush/SIEM rule for:

| Rule | Suggested threshold | Action |
|---|---:|---|
| Admin probing | 20 responses with 401/403 from one IP in 5 minutes | Review CF-Ray/IP; apply temporary WAF or rate rule |
| Global auth spike | 100 responses with 401/403 in 5 minutes | Inspect deployment and Google auth errors |
| Rate-limit pressure | 30 responses with 429 in 5 minutes | Review client behavior and abuse |
| Worker failure | 5 responses with 5xx in 5 minutes | Investigate immediately |
| Slow requests | P95 duration over 1500ms for 10 minutes | Check origin, D1, and external providers |

These thresholds are starting points and should be adjusted after observing normal traffic. Security alerts should not include sensitive request bodies.

## Dashboard path

Cloudflare Dashboard → Workers & Pages → `navixa` → Observability. For retention or external correlation, configure Workers Logpush to an approved R2/SIEM destination. Keep normal traffic sampled and retain security events longer where the plan allows.
