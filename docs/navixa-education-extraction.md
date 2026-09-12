# NAVIXA Education extraction boundary

Status: planning only. No production cutover, deletion, database migration, or LIVE enablement is authorized by this document.

## Product rule

NAVIXA Education is an independent product under the NAVIXA umbrella.

It must ultimately have its own repository, deployment, database, admin surface, secrets, tests, release lifecycle, and product UI. Shared NAVIXA capabilities may be consumed only through explicit adapters/contracts rather than direct imports or direct reads of NAVIXA production tables.

## Existing Education core in Navixa-v1

The following files form the current study-suspension feature boundary:

- `worker/studySuspension.ts`
- `worker/studySuspensionPoll.ts`
- `worker/studySuspensionStore.ts`
- `worker/studySuspensionX.ts`
- `app/api/admin/study-suspension/poll/route.ts`
- `app/api/admin/study-suspension/test/route.ts`
- `migrations/0048_study_suspension_alerts.sql`
- `tests/study-suspension.test.ts`
- `tests/study-suspension-integration.test.ts`
- `tests/study-suspension-x.test.ts`

Supporting changes also touch `worker/index.ts`, `worker/generalPush.ts`, `app/api/push/subscriptions/route.ts`, and `package.json`.

## Shared NAVIXA dependencies that must NOT be copied blindly

The current Education feature directly depends on NAVIXA-owned infrastructure:

- Push delivery via `worker/generalPush.ts` and `navixa_push_subscriptions`.
- Telegram delivery and encrypted chat identifiers via `worker/telegramBot.ts` and `navixa_user_telegram_links`.
- NAVIXA user IDs as recipient identifiers.
- NAVIXA D1 `DB` binding.
- NAVIXA cron/worker entrypoint through `worker/index.ts`.
- NAVIXA admin-session protections on the current test endpoints.

These dependencies are the main extraction boundary.

## Safe extraction sequence

1. Keep current NAVIXA production behavior unchanged and TEST-only.
2. Create a new standalone `navixa-education` repository before copying runtime code.
3. Copy the Education domain logic and tests first, without deleting anything from Navixa-v1.
4. Replace direct NAVIXA imports/tables with Education-owned interfaces:
   - `NotificationGateway`
   - `IdentityGateway`
   - `EducationRepository`
   - `OfficialSourceGateway`
5. Create a separate Education database schema. Do not point the new product at the NAVIXA production D1 database.
6. Create Education-owned Push/Telegram adapters or a versioned NAVIXA shared-service API. Never share raw encryption keys or read NAVIXA tables cross-product.
7. Run Education in isolated TEST mode and compare results against the existing NAVIXA implementation.
8. Only after parity, security checks, and release gates succeed may traffic be cut over.
9. Remove old NAVIXA runtime code only in a later, separate PR after rollback is no longer needed.

## Initial Education data model

The standalone database should own equivalents of:

- education users/profile linkage (with an external NAVIXA identity reference if SSO is later enabled)
- study suspension profiles
- trusted official sources
- source cursors
- delivery deduplication ledger
- Education notification subscriptions
- audit log

Table names should be Education-owned and should not use NAVIXA production tables as their source of truth.

## Release guardrails

- TEST mode remains the default.
- No LIVE delivery until explicitly enabled in the Education project after independent verification.
- No production secrets are copied into source control.
- No NAVIXA production table is altered as part of extraction.
- No old code is deleted during the copy-and-verify phase.
- Every cutover must have a rollback path.

## Current finding

The study-suspension domain logic is reasonably separable, but notification delivery, user linkage, storage, encryption, cron scheduling, and admin authentication are still coupled to Navixa-v1. The next implementation step is therefore creation of the standalone repository and its clean application shell, followed by adapter-based extraction rather than direct file movement.
