# NAVIXA Education extraction staging

This directory is a temporary, isolated extraction workspace for the future standalone `navixa-education` repository.

## Safety state

- Not production.
- Not deployed.
- Does not modify NAVIXA runtime routes, database, push subscriptions, Telegram links, or secrets.
- Existing NAVIXA education code remains untouched as a rollback source.
- Dispatch defaults to `test` and is fail-closed unless a recipient is explicitly allowlisted.

## Boundary

The extracted core owns:

- official study-suspension event validation;
- general/higher-education targeting;
- region/city/education administration/university/school matching;
- source-post deduplication;
- official X post classification and normalization.

The extracted core does not own NAVIXA's existing shared push, Telegram, authentication, or D1 tables. Those will be replaced by Education-specific adapters and storage before any standalone deployment.

## Promotion gates

The extraction must not be promoted until all of these are true:

1. Isolated tests pass.
2. NAVIXA's full PR verification remains green.
3. Education has its own repository and runtime configuration.
4. Education-specific database schema and transport adapters are implemented.
5. A migration/cutover plan is tested with rollback.
6. No production deletion or LIVE enablement occurs during extraction.

## Verification

From this directory:

```bash
npm test
```

Node 22+ is required. No package installation is needed for the current extraction tests.
