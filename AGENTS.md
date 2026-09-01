# NAVIXA Engineering Agent Constitution

These instructions apply to every AI coding task in this repository.

## 1. Read before editing
Before every task, read `AI_ONBOARDING.md`, `PROJECT_MEMORY.md`, and `AI_WORKSPACE.md` completely. Follow the coordination rules in `AI_WORKSPACE.md`. Do not edit files reserved by another active agent. Re-read `git status` and target files immediately before editing because another assistant may have changed them.

## 2. Core workflow
For Arabic workflow descriptions use right-to-left meaning and left arrows:

تحقق ← افهم ← خطط ← احفظ نقطة رجوع ← نفذ ← اختبر ← أمّن ← راجع ← انشر ← تحقق

For English workflow descriptions use left-to-right meaning and right arrows:

Verify → Understand → Plan → Safe Restore Point → Implement → Test → Secure → Review → Deploy → Verify

Never skip directly to implementation when repository evidence can answer the question first.

## 3. Understand and plan
- Inspect the relevant architecture, package scripts, dependencies, data flow, authentication, authorization, APIs, database access, environment boundaries, deployment configuration, and existing similar code.
- Identify the root cause for bugs before changing code.
- Prefer the smallest maintainable change that solves the actual problem.
- Avoid unrelated refactors, duplicate components/services/hooks/utilities, and unnecessary dependencies.
- State or internally establish the affected files, risks, verification plan, and rollback path before material changes.

## 4. Safe restore point
- Inspect Git state before risky work.
- Preserve existing stable behavior and other agents' work.
- For substantial or risky changes, use an isolated branch/PR when available and keep a known stable commit/deployment to roll back to.
- Never overwrite or revert another agent's changes unless the user explicitly requests it.

## 5. Implementation quality
- Follow the repository's existing conventions and architecture.
- Fix root causes, not symptoms.
- Keep server-only secrets and privileged logic on the server.
- Never treat hidden UI as authorization.
- Validate untrusted input server-side.
- Do not invent files, APIs, commands, successful tests, deployments, or capabilities.
- Do not add a dependency when the repository can solve the problem cleanly without it.

## 6. Security baseline
Review applicable changes for authentication, authorization, broken access control/IDOR, session handling, input validation, XSS, CSRF, injection, SSRF, unsafe redirects, path traversal, file uploads, rate limiting, secret exposure, dependency risk, admin permissions, billing/subscription integrity, webhook verification, and third-party integrations.

Never commit passwords, tokens, cookies, API keys, private credentials, or sensitive user data. If a secret was exposed, removal from code is insufficient: rotate/revoke it and update the runtime configuration.

## 7. Testing and verification
Use only scripts that actually exist in this repository. For NAVIXA, prefer the repository verification chain where applicable: `npm run lint`, `npm test`, `npm run test:ui`, `npm run build`, or the combined `npm run test:verify` / `npm run test:clean` scripts.

Test the normal path, edge cases, expected failures, authorization boundaries, and regression risk. For bug fixes, add or update a regression test when practical. A successful build alone is not proof that the feature works.

## 8. Review before release
Review the complete diff as if it were a pull request:
- Every changed line should have a reason.
- Remove temporary/debug/dead code.
- Check for side effects and unnecessary complexity.
- Confirm security-sensitive paths are enforced server-side.
- Confirm existing behavior was not unintentionally broken.

## 9. Deployment and rollback
Preferred English release flow:

Local Verify → Commit → Push → CI/Checks → Preview/Staging → Verify → Merge → Production → Post-deploy Verify

Arabic equivalent:

تحقق محلي ← حفظ التغيير ← رفعه ← فحوصات آلية ← نسخة تجريبية ← تحقق ← دمج ← إنتاج ← تحقق بعد النشر

Do not declare deployment successful without checking the actual deployed environment when access is available. If production is materially broken, prefer restoring the last stable version first, then fix safely, retest, and redeploy.

## 10. Observability and privacy
Use logs to diagnose problems but never log passwords, tokens, cookies, API keys, or sensitive personal data. Show users safe, understandable errors; keep technical diagnostics in protected logs. Do not expose production stack traces to end users.

## 11. UI/UX and accessibility
For user-facing changes, preserve NAVIXA's design language and test responsive behavior, loading, empty, error, success, and disabled states. Maintain keyboard navigation, focus visibility, semantic HTML, labels, contrast, and screen-reader compatibility where applicable.

## 12. Performance
Check bundle/client weight, unnecessary client components or re-renders, image/font loading, database/API query cost, caching, and latency when relevant. Optimize based on evidence rather than speculative complexity.

## 13. Definition of Done
A task is done only when the applicable items are true: requested behavior implemented; code is maintainable; relevant lint/type/build/tests pass; security boundaries reviewed; no secrets exposed; deployment/preview verified when applicable; rollback path known; documentation updated when behavior/setup/architecture changed.

## 14. NAVIXA coordination and memory
After completing work:
1. Update `AI_WORKSPACE.md` with the completed stage, verification result, next proposed stage, and release all reservations.
2. Append one concise entry to `AI_CHANGELOG.md` describing the outcome and changed files.
3. Update `PROJECT_MEMORY.md` only when the user approves a durable product decision.

## Golden rule
Do not merely produce code that runs. Produce code that is safe, clear, maintainable, testable, reversible, and production-ready.