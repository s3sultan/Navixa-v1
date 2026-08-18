# Cloudflare Performance and Staging Research

## Edge caching

Source: https://developers.cloudflare.com/workers/reference/how-the-cache-works/

Cloudflare documents that Worker-generated responses can be cached with the Cache API, and that a response stored in cache can return `CF-Cache-Status: HIT`. The Cache API is local to a data center and does not support tiered caching; `fetch()` is preferred when the Worker acts as middleware. The implementation should keep admin and personalized responses out of cache and use a stable public key for the homepage.

Source: https://developers.cloudflare.com/cache/concepts/cache-responses/

`CF-Cache-Status: HIT` means the resource was found in Cloudflare cache. `DYNAMIC` means the request was not eligible for cache; `BYPASS` means it was eligible but response headers or origin behavior prevented caching. `Set-Cookie`, `private`, and `no-store` can prevent caching. `Age` appears for cache-served responses.

## Workers Logs

Source: https://developers.cloudflare.com/workers/observability/logs/workers-logs/

Workers Logs requires an `observability` setting in Wrangler. Recommended configuration is `observability.enabled: true` and `head_sampling_rate` between 0 and 1. Structured JSON logs are recommended; custom `console.log` events and invocation logs are available in the dashboard. Workers Logs retention and limits vary by plan, so security events should be prioritized and sensitive values must be redacted.

## D1 environments

Source: https://developers.cloudflare.com/d1/configuration/environments/

Cloudflare supports separate Wrangler environments with separate D1 bindings. Staging should use a distinct database ID and Worker name, never the production database. The NAVIXA staging workflow expects `STAGING_D1_DATABASE_ID`, `ADMIN_JWT_SECRET_STAGING`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` secrets and deploys `navixa-staging`.
