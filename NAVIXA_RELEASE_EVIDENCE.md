# NAVIXA Release Evidence

## 2026-09-05 — Launch readiness polish

### Context and conclusion
The homepage release candidate fixes the verified greeting hydration mismatch and reduces first-screen density without changing authentication, authorization, billing, APIs, or production secrets. The branch includes the latest `master`; Pull Request checks, the release gate, and deployed staging verification have passed with no unresolved BLOCK item.

### Before ← Delta ← After
| Element | Classification | Evidence | Impact |
| --- | --- | --- | --- |
| Greeting rendering | Changed | `app/page.tsx`, hydration regression test | Server and first client render now share a stable value; local time is applied after mount. |
| Desktop secondary tools | Changed | `app/page.tsx`, `app/navixa.css` | Essential tools stay prominent; supporting tools remain available behind one explicit control. |
| Mobile home | Unchanged | mobile UI smoke at 390×844 | Dedicated mobile hub, primary actions, and “more” navigation remain visible. |
| Windows verification | Changed | `tests/ui-smoke.mjs`, `package.json` | Vinext and Chrome start portably, wait for document readiness, and clean up listeners. |
| Access/security boundaries | Unchanged | API/auth/security regression suites | No trust boundary or privileged server behavior changed. |

### Gate status
| Gate | Status | Evidence / next action |
| --- | --- | --- |
| Build | PASS | `npm run test:verify`: lint, 115 tests, UI smoke, and production build passed after merging latest `master`. |
| Security | PASS | Security/auth/access suites passed; `npm audit --omit=dev --audit-level=high` found 0 vulnerabilities; GitHub Actions security and secret exposure guards passed. |
| SEO | PASS | Existing SEO/security baseline passed; canonical production URL is documented as `https://navixasa.com`. |
| Accessibility | PASS | Semantic toggle with `aria-expanded`/`aria-controls`, visible focus, RTL mobile and desktop manual review. |
| Performance | WARN | Secondary desktop content is deferred until requested; no synthetic performance number was measured in this change. |
| Links | PASS | UI smoke passed homepage, Today, account/admin guard, and meetings paths. |
| Preview | PASS | Staging run `33978081612` deployed and passed runtime/header/path/origin checks; manual review at 390×844 and 1440×1000 found no Console errors. |

### Launch decision
PASS with one documented, non-blocking performance WARN. Production may proceed only through the reviewed `master` deployment workflow and must still pass post-deploy verification on `https://navixasa.com`.

### Rollback
- Pre-change production remains the active rollback until deployment succeeds.
- Revert PR #128 or roll production back to the previous verified Worker deployment if post-deploy checks fail materially.

## 2026-09-05 — Public plan branding cleanup

### Scope
- Public plan names: `هِمّة` and `عَزْم`.
- Remove public founders-promotion entry points from the NAVIXA homepage.
- Preserve compatibility routes and internal identifiers such as `/plus` and `/sprint`.
- No billing schema, entitlement, portfolio membership, or production-secret changes are part of this release.

### Included reviewed changes
- PR #108: public plan naming, trial/renewal copy, founders-promotion cleanup, regression coverage.
- PR #109: corrected the actual homepage JSX source so visible legacy `Plus` badges and founders links are removed at source rather than hidden by CSS.

### Release candidate
This release branch was cut from master commit `1e48e3cf0696afd9f67aa96d1c46a05be9b22de7` after the branding fixes were already merged. The production deployment workflow remains manual-only and requires merged-PR provenance.

### Gate status
| Gate | Status | Evidence / next action |
| --- | --- | --- |
| Build | PENDING | PR verification must complete successfully. |
| Security | PENDING | GitHub Actions security and secret-scan gates must pass. |
| SEO | N/A | No SEO behavior change in this release. |
| Accessibility | N/A | No interaction model change; public labels only. |
| Performance | N/A | No runtime dependency or bundle feature added by this release marker. |
| Links | PENDING | Regression checks must confirm founders entry points are absent and compatibility routes remain intact. |
| Preview | N/A | Branding source was already reviewed in merged PRs; production post-deploy verification remains required. |

### Rollback
The pre-release restore point is branch `backup/pre-branding-release-2026-09-05` at `1e48e3cf0696afd9f67aa96d1c46a05be9b22de7`. If production verification fails materially, restore the last known stable production version before further diagnosis.

### Post-deploy checks
- `https://navixasa.com` loads normally.
- No visible `Plus` or `SPRINT` labels remain in the homepage experience.
- Visible plan names are `هِمّة` and `عَزْم`.
- No homepage entry point for `عرض المؤسسين` remains.
- Account/authentication and existing production security headers continue to work.
