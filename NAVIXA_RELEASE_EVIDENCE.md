# NAVIXA Release Evidence

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
