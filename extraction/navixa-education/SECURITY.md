# NAVIXA Education Security Boundary

## Product isolation

NAVIXA Education is a standalone product under the NAVIXA umbrella. It must own its deployment, database, secrets, notification credentials, audit logs, and release lifecycle.

## Forbidden coupling

The standalone Education repository must not:

- read or write NAVIXA production tables directly;
- import NAVIXA runtime worker files directly;
- reuse NAVIXA encryption keys;
- copy production secrets into source control;
- default to LIVE delivery;
- depend on NAVIXA deployment success for its own release.

## Allowed integration

Cross-product integration is permitted only through explicit, versioned contracts such as SSO identity claims or authenticated service APIs. Shared branding is not shared runtime state.

## Delivery safety

- TEST mode is the default.
- LIVE requires an explicit Education-owned release decision and configuration.
- Official-source events must remain verified before dispatch.
- Delivery deduplication must remain enabled.
- Failed delivery claims must be releasable for retry.

## Data safety

Education owns tables prefixed `education_` in its own database. A future SSO link may retain an external NAVIXA subject identifier, but NAVIXA must not remain the Education database source of truth.

## Cutover rule

Migration is COPY-first. No NAVIXA production code or data is deleted during extraction. Cleanup happens only in a later change after independent Education verification and a tested rollback path.
