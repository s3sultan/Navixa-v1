# NAVIXA Pre-Launch Gate

NAVIXA-owned release gate for deciding whether a build is actually ready to launch.

This is an internal engineering protocol. It adds no third-party runtime dependency, branding, attribution, badge, or user-facing credit.

## Principle
A build is not ready because implementation stopped. It is ready only when the applicable launch gates have evidence.

Arabic flow:
`البناء ← الأمان ← SEO ← الوصول ← الأداء ← الروابط ← المعاينة ← الإطلاق ← التحقق`

English flow:
`Build → Security → SEO → Accessibility → Performance → Links → Preview → Launch → Verify`

## Status model
Each applicable gate receives one status:
- PASS: verified with evidence.
- WARN: non-blocking issue with documented impact and owner/next action.
- BLOCK: launch must stop until fixed or explicitly accepted by an authorized human for a genuinely non-security exception.
- N/A: not applicable, with a short reason.

Security, access-control, secret exposure, destructive data-loss risk, broken authentication, broken payment/subscription enforcement, and critical privacy failures are never downgraded merely to make a release pass.

## Gate 1: Build and code integrity
Verify using scripts that actually exist in the repository:
- install/dependency resolution is reproducible
- lint/type checks pass where configured
- relevant automated tests pass
- production build succeeds
- no temporary/debug/dead code materially affects release
- no unexpected generated files or unrelated changes

A successful build alone does not pass the release gate.

## Gate 2: Security
Review applicable OWASP-style risks and NAVIXA boundaries:
- authentication and session handling
- authorization and broken access control / IDOR
- server-side entitlement/subscription enforcement
- input validation and injection risks
- XSS, CSRF, SSRF, unsafe redirects, path traversal, uploads
- admin actions and privileged APIs
- webhook/integration verification
- rate limiting/abuse controls where relevant
- dependency risk
- no exposed secrets, credentials, tokens, cookies, private keys, or sensitive data
- production errors do not leak stack traces or sensitive internals

Any material trust-boundary change should also use `NAVIXA_VISUAL_REVIEW.md`.

## Gate 3: SEO and discoverability
For public/indexable pages verify where applicable:
- unique useful page title and description
- canonical behavior is intentional
- robots directives are intentional
- sitemap/robots files are reachable and correct when used
- important pages are internally reachable
- heading structure is coherent
- social/share metadata is sensible where used
- redirects do not create loops or accidental login walls
- production hostname/protocol behavior is correct
- no accidental `noindex` on pages intended for search

Private/authenticated application pages may be N/A for indexing, but the reason must be explicit.

## Gate 4: Accessibility
Verify applicable user-facing flows:
- semantic HTML and meaningful labels
- keyboard navigation
- visible focus
- heading hierarchy
- form errors and recovery guidance
- sufficient contrast
- critical state is not communicated by color alone
- dialogs/menus/popovers/tabs manage focus correctly
- touch targets remain usable
- reduced-motion preference is respected
- Arabic RTL and English LTR behavior remain correct

## Gate 5: Performance and resilience
Check based on evidence:
- avoid unnecessary client bundle weight
- images/fonts load appropriately
- avoid obvious layout shifts and blocking work
- API/database work is not needlessly repeated
- loading, empty, error, retry, and degraded states are usable
- network/service failure does not produce destructive or misleading behavior
- caching is intentional where relevant

Do not invent performance numbers. Record measurements only when actually measured.

## Gate 6: Links, navigation, and external boundaries
Verify:
- primary navigation destinations work
- critical CTAs reach the intended destination
- no known broken internal links in release-critical flows
- external links use the intended safe behavior
- redirects preserve the intended domain/project boundary
- cross-project NAVIXA links do not accidentally grant access
- logout/login/account recovery paths behave intentionally

## Gate 7: Preview / staging verification
Before production when preview/staging is available:
- open the actual deployed preview
- test representative desktop and mobile widths
- test primary user journey
- test expected failure/denial path
- inspect visible console/runtime errors when available
- verify environment-specific configuration without exposing secrets
- confirm auth/subscription boundaries against the deployed environment where safe

Do not mark preview verified if only local code was tested.

## Gate 8: Launch decision
Summarize all gates in one table:

| Gate | Status | Evidence | Blocking issue / next action |
| --- | --- | --- | --- |
| Build | PASS/WARN/BLOCK/N/A | command/check | action |
| Security | PASS/WARN/BLOCK/N/A | review/test | action |
| SEO | PASS/WARN/BLOCK/N/A | page/config check | action |
| Accessibility | PASS/WARN/BLOCK/N/A | interaction/scan/manual check | action |
| Performance | PASS/WARN/BLOCK/N/A | measurement/check | action |
| Links | PASS/WARN/BLOCK/N/A | navigation check | action |
| Preview | PASS/WARN/BLOCK/N/A | deployed URL/environment check | action |

Launch is allowed only when there are no unresolved BLOCK items.

## Gate 9: Post-deploy verification
Production deployment is not the finish line. After deployment verify:
- production URL loads as intended
- critical user journey works
- authentication/access boundaries still hold
- no new critical runtime errors are evident
- redirects/domains/SEO headers behave as intended
- rollback remains available

If production is materially broken, restore the last known stable version first when practical, then diagnose safely.

## Evidence rule
Never claim PASS without evidence from an actual command, repository inspection, runtime check, deployed environment, or deliberate manual verification. If a check could not run, mark it WARN, BLOCK, or N/A as appropriate instead of guessing.

## Relationship to Visual Review
`NAVIXA_VISUAL_REVIEW.md` explains material system changes and their evidence.
`NAVIXA_PRE_LAUNCH_GATE.md` decides whether the resulting release is ready to ship.

Together:
`افهم التغيير ← اثبت أثره ← افحص الإصدار ← انشر ← تحقق`

`Understand change → Prove impact → Gate release → Deploy → Verify`
