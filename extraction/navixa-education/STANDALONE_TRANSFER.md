# Standalone transfer map

Target repository: `s3sultan/navixa-education`
Target default branch: `main`

## Copy to repository root

- `README.md` -> `README.md`
- `SECURITY.md` -> `SECURITY.md`
- `.gitignore` -> `.gitignore`
- `package.json` -> `package.json`
- `.github/workflows/verify.yml` -> `.github/workflows/verify.yml`
- `src/contracts.ts` -> `src/contracts.ts`
- `src/runtimePolicy.ts` -> `src/runtimePolicy.ts`
- `src/studySuspension.ts` -> `src/studySuspension.ts`
- `src/studySuspensionX.ts` -> `src/studySuspensionX.ts`
- `schema/0001_education_core.sql` -> `schema/0001_education_core.sql`
- `tests/isolation-boundary.test.ts` -> `tests/isolation-boundary.test.ts`
- `tests/runtime-policy.test.ts` -> `tests/runtime-policy.test.ts`
- `tests/schema-boundary.test.ts` -> `tests/schema-boundary.test.ts`
- `tests/study-suspension.test.ts` -> `tests/study-suspension.test.ts`

## Do not copy

- NAVIXA production `.env` files or secrets.
- NAVIXA D1 bindings or database identifiers.
- `worker/generalPush.ts`.
- `worker/telegramBot.ts`.
- NAVIXA production migrations.
- NAVIXA deployment workflows.
- Any `navixa_*` production tables.

## First standalone verification

1. Create an empty private repository named `navixa-education`.
2. Copy only the allowlisted files above.
3. Push to `main` with no production secrets configured.
4. Confirm GitHub Actions `Verify NAVIXA Education` passes.
5. Keep runtime delivery in TEST mode.
6. Create Education-owned database and notification adapters only after the clean baseline is green.

## Rollback

Until standalone parity is verified, NAVIXA remains unchanged and is the rollback source. No deletion from `Navixa-v1` is part of this transfer.
