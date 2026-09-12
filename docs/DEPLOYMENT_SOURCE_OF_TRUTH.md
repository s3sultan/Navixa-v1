# NAVIXA Deployment Source of Truth

Last verified: 2026-09-12

## Canonical source

- Repository: `s3sultan/Navixa-v1`
- Production branch: `master`
- This repository is the only canonical code source for NAVIXA.

## Production deployment

- Production domain: `https://navixasa.com`
- Runtime/hosting: Cloudflare Worker
- Worker name: `navixa`
- Production workflow: `.github/workflows/deploy-navixa.yml`
- Production deployments must originate from reviewed `master` history through the guarded GitHub Actions workflow.

## Legacy repository

- `s3sultan/Navixa` is deprecated and must not be treated as a source of truth.
- Vercel Git deployments from the deprecated repository are intentionally disabled.
- Do not publish production or preview work from the deprecated repository.

## Vercel status

- The existing Vercel project named `navixa` is legacy infrastructure and is not the NAVIXA production path.
- It must not be used to infer production freshness, deployment state, or the canonical repository.
- If Vercel is used again in the future, it must first be explicitly reconnected to `s3sultan/Navixa-v1` and documented here before any automatic Git deployment is enabled.

## Rule for agents and maintainers

Before changing, reviewing, or deploying NAVIXA, verify all of the following:

1. Repository is `s3sultan/Navixa-v1`.
2. Production code comes from `master`.
3. Production deployment uses the Cloudflare workflow in this repository.
4. `s3sultan/Navixa` and the legacy Vercel project are not used as production references.

If any tool reports conflicting deployment information, this document and the guarded production workflow in `Navixa-v1` take precedence until the infrastructure is intentionally migrated and this document is updated in the same reviewed change.
