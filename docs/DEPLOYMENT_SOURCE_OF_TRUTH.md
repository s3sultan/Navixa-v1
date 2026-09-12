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
- Automatic production workflow: `.github/workflows/deploy-navixa-auto.yml`
- Controlled/manual production workflow: `.github/workflows/deploy-navixa.yml`
- Automatic production deployment accepts reviewed `master` commits with merged-pull-request provenance, then runs dependency audit, lint/tests/UI smoke/build, GitHub Actions audit, committed-secret scan, production D1 migrations, Worker deployment, production smoke tests, sync-route verification, and security-header verification.
- The controlled/manual workflow is the guarded operator path for an explicitly selected reviewed `master` commit.
- Production deployments must originate from reviewed `master` history through one of these guarded workflows in this repository.

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
2. Production code comes from reviewed `master` history.
3. Production deployment uses the guarded Cloudflare workflows in this repository.
4. `s3sultan/Navixa` and the legacy Vercel project are not used as production references.

If any tool reports conflicting deployment information, this document and the guarded production workflows in `Navixa-v1` take precedence until the infrastructure is intentionally migrated and this document is updated in the same reviewed change.
