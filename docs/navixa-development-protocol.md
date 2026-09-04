# NAVIXA Development Protocol

This document defines the internal development gate for NAVIXA.

## Goal

Reduce regressions and cross-project breakage by separating planning, implementation, review, verification, and merge decisions.

## Workflow

1. **Spec**
   - Write the requested behavior in NAVIXA terms.
   - Define affected areas and explicit non-goals.
   - Record security, privacy, billing, auth, localization, and deployment impact when relevant.

2. **Isolated implementation**
   - Work on a dedicated branch.
   - Keep the change limited to the approved scope.
   - Do not redesign unrelated behavior while implementing.

3. **Local verification**
   - Run the smallest relevant tests first.
   - Run lint and type/build checks when the change touches shared code.
   - For release-bound changes, run the repository verification command before merge.

4. **Independent review**
   - Review the diff from a fresh context that did not author the change.
   - The reviewer is read-only and must not modify repository files.
   - Review for correctness, regressions, security, privacy, auth, entitlements, billing, localization, performance, and deployment risk as applicable.
   - Classify findings as BLOCKER, MAJOR, MINOR, or CLEAR.

5. **Fix and re-review**
   - BLOCKER and MAJOR findings must be resolved before merge.
   - Re-review only the changed scope plus any directly affected paths.

6. **Final gate**
   - Confirm tests pass.
   - Confirm no unrelated files changed.
   - Confirm no secrets, credentials, debug output, temporary files, or accidental external notices were introduced.
   - Confirm the change preserves NAVIXA branding and project boundaries.

7. **Merge**
   - Merge only after the final gate is CLEAR.

## Project boundary rule

NAVIXA, NAVIXA Kids, NAVIXA English Learning, NAVIXA Fitness, and NAVIXA Meetings are separate products. A change in one project must not silently alter another project's UI, auth, subscription access, data model, or deployment behavior.

Shared account or entitlement logic must be reviewed for every affected project before merge.

## External-source rule

- Do not copy external repository code, documentation, prompts, templates, branding, comments, headers, notices, or attribution text into NAVIXA unless an explicit legal and technical review approves that exact use.
- Prefer implementing ideas and architecture independently in original NAVIXA code.
- Before adopting third-party code, verify the license and all notice, attribution, redistribution, source-disclosure, trademark, and network-use obligations.
- If obligations conflict with NAVIXA requirements, do not import the material.
- Never remove legally required notices from third-party material. Instead, avoid importing material whose obligations are unacceptable.

## Reviewer checklist

- [ ] Scope matches the spec
- [ ] No unrelated changes
- [ ] Relevant tests pass
- [ ] Build/lint/type checks pass where applicable
- [ ] Auth and session behavior preserved
- [ ] Subscription and entitlement boundaries preserved
- [ ] No secret or credential exposure
- [ ] No unsafe data collection or logging
- [ ] No accidental external branding or attribution text
- [ ] No copied external code without approved license review
- [ ] Arabic/English direction and localization preserved where affected
- [ ] Deployment and rollback impact understood

## Merge verdict

Use one of these final verdicts:

- **CLEAR**: safe to merge based on the reviewed scope.
- **MINOR**: safe only if the listed minor items are explicitly accepted.
- **MAJOR**: do not merge until fixed.
- **BLOCKER**: stop and resolve before any further release action.
