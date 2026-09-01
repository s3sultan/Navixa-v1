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

## 11. UI/UX Quality Layer
All user-facing work must meet a high visual and interaction quality bar. Treat UI quality as part of correctness, not decoration.

### Design intent before coding
- Identify the page goal, primary user action, information hierarchy, target device sizes, and existing NAVIXA design patterns before touching layout.
- Preserve the established product identity unless the task explicitly calls for redesign.
- Reuse existing components, tokens, spacing, radii, typography, icon language, and interaction patterns before introducing new ones.
- Prefer intentional visual systems over isolated styling decisions.

### Hierarchy and composition
- Make the primary action visually obvious without making every element loud.
- Use clear hierarchy across page title, section title, body text, metadata, actions, and helper text.
- Group related information spatially and separate unrelated information with meaningful whitespace.
- Avoid overcrowded cards, excessive containers, decorative gradients, unnecessary glass effects, giant headlines, or repeated badges that do not carry information.
- Avoid generic AI-generated dashboard composition when a simpler product-specific layout communicates better.

### Spacing and alignment
- Use a consistent spacing scale rather than arbitrary values.
- Align content to a predictable grid.
- Maintain consistent internal padding for equivalent components.
- Use whitespace to communicate grouping and priority.
- Do not fix layout problems by stacking random margins or absolute positioning unless the design truly requires it.

### Typography
- Keep a deliberate type scale with a small number of levels.
- Maintain readable line lengths, line heights, and contrast.
- Avoid excessive font weights, all-caps text, tiny helper copy, or oversized marketing typography inside product workflows.
- Arabic and English typography must remain visually balanced and directionally correct.

### Color and contrast
- Use color semantically: primary action, success, warning, destructive, neutral, and informational states should remain distinguishable.
- Do not introduce new colors when an existing semantic token works.
- Meet accessible contrast expectations for text, controls, focus indicators, and important status information.
- Never rely on color alone to communicate critical state.

### Components and states
Every interactive component must account for relevant states:
- default
- hover
- focus
- active/pressed
- disabled
- loading
- success
- error
- empty

Forms must have clear labels, validation feedback, recovery guidance, and sensible defaults. Buttons must use precise action language. Destructive actions require clear intent and suitable confirmation when consequences are significant.

### Responsive design
- Design mobile and desktop behavior intentionally; do not merely shrink the desktop layout.
- Prevent clipped content, horizontal overflow, unusable tap targets, and crowded controls.
- Prioritize the most important information on small screens and progressively reveal secondary details when appropriate.
- Test representative narrow, medium, and wide widths.

### Accessibility
- Use semantic HTML before ARIA.
- Preserve keyboard navigation, visible focus, correct labels, heading hierarchy, and screen-reader meaning.
- Keep touch targets comfortably usable.
- Respect reduced-motion preferences where animation exists.
- Ensure dialogs, menus, popovers, tabs, and forms have correct focus behavior.

### Motion and interaction polish
- Motion must communicate state, hierarchy, continuity, or feedback.
- Prefer subtle transitions over constant animation.
- Avoid animation that delays task completion or competes with content.
- Keep durations and easing consistent across similar interactions.
- Loading feedback should appear quickly and avoid layout jumps where possible.

### Icons and visual language
- Prefer the project's existing icon system and vector icons over emoji used as UI icons.
- Keep icon stroke, size, alignment, and semantic meaning consistent.
- Do not mix unrelated icon styles within the same surface.

### Content quality
- Use concise, human, action-oriented interface copy.
- Remove filler, generic hype, repetitive explanations, fake urgency, and robotic AI phrasing.
- Error messages should explain what happened and what the user can do next when possible.
- Empty states should guide the next useful action rather than merely announce emptiness.

### Visual review checklist
Before marking UI work complete, visually inspect:
- hierarchy
- alignment
- spacing rhythm
- typography
- contrast
- component consistency
- RTL/LTR behavior
- responsive layouts
- loading/empty/error/success states
- keyboard/focus behavior
- unnecessary visual noise

Do not accept a technically functioning interface that visibly looks unfinished, inconsistent, generic, or awkward.

## 12. Performance
Check bundle/client weight, unnecessary client components or re-renders, image/font loading, database/API query cost, caching, and latency when relevant. Optimize based on evidence rather than speculative complexity.

## 13. Definition of Done
A task is done only when the applicable items are true: requested behavior implemented; code is maintainable; relevant lint/type/build/tests pass; security boundaries reviewed; no secrets exposed; deployment/preview verified when applicable; rollback path known; documentation updated when behavior/setup/architecture changed; user-facing work passes the UI/UX quality review above.

## 14. NAVIXA coordination and memory
After completing work:
1. Update `AI_WORKSPACE.md` with the completed stage, verification result, next proposed stage, and release all reservations.
2. Append one concise entry to `AI_CHANGELOG.md` describing the outcome and changed files.
3. Update `PROJECT_MEMORY.md` only when the user approves a durable product decision.

## Golden rule
Do not merely produce code that runs. Produce code that is safe, clear, maintainable, testable, reversible, visually coherent, accessible, and production-ready.