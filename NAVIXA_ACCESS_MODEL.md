# NAVIXA Central Access Model

This document is the authoritative product rule for accounts, subscriptions, memberships, trials, and project entitlements across the NAVIXA ecosystem.

## Central authority
NAVIXA main is the source of truth for account identity, subscription state, membership ownership, project entitlements, device/session policy, trial state, usage limits, and admin overrides.

NAVIXA Kids, NAVIXA English Learning, and NAVIXA Fitness must not create an independent subscription model that contradicts or bypasses this authority.

Arabic flow:
NAVIXA الرئيسي ← الحساب ← الاشتراك ← العضوية ← صلاحيات المشاريع

English flow:
NAVIXA Main → Account → Subscription → Membership → Project Entitlements

## Public plans
### 1. هِمّة
هِمّة is the full paid NAVIXA plan for 30 days. The primary هِمّة subscriber receives access to all approved paid NAVIXA features and the included projects:
- NAVIXA main
- NAVIXA Kids
- NAVIXA English Learning
- NAVIXA Fitness

Heavy AI services, session summaries, and other full paid capabilities belong to هِمّة unless a later approved product rule explicitly changes that entitlement.

### 2. عَزْم
عَزْم is a focused 5-day plan. It receives:
- all currently available free/basic NAVIXA features
- name/keyword listening alerts
- screen monitoring

عَزْم does **not** include heavy AI summarization, session summaries, or other heavy smart services reserved for هِمّة.

The internal identifiers `monthly` / `sprint` and compatibility routes `/plus` / `/sprint` may remain for technical compatibility. They are not the public plan names and must not leak into user-facing copy.

### 3. Launch trial
The approved launch trial is a global limited trial window, not a per-user N-day trial.
- Starts: 2026-09-05, Asia/Riyadh.
- Ends: 2026-09-12 at 16:00, Asia/Riyadh.
- During the active window, users may try the entire NAVIXA site subject to explicit quotas and usage limits for heavy services.
- Heavy-service limits must protect هِمّة subscriber quality and operating capacity.
- From 2026-09-09, the public experience may show increasingly visible registration/subscription reminders.
- At expiry, non-subscribers return to the free tier; the whole site must not be locked.
- Trial timing must not be hard-coupled to payment-provider activation. Admin controls must be able to extend or end the campaign without changing the product entitlement definitions.

## Additional memberships
### One comprehensive additional member
A هِمّة owner may add one additional member with a separate email. This member receives the approved هِمّة project access but must not gain subscription-owner privileges unless explicitly granted by a later approved policy.

### One paid project-only additional member
A هِمّة owner may add one paid project-only member with a separate email. Exactly one project must be selected at creation:
- NAVIXA Kids
- NAVIXA English Learning
- NAVIXA Fitness

This membership grants access only to the selected project. It must not unlock NAVIXA main or another project.

### Kids child profiles
The هِمّة owner may have up to two child profiles for NAVIXA Kids. Child profiles are scoped to NAVIXA Kids and must not inherit adult, admin, or subscription-management permissions.

## Identity uniqueness
- Membership is tied to a distinct email/account identity where email identity applies.
- The same email must not be active under two different subscription owners at the same time unless an explicit migration or transfer policy allows it.
- Project applications must not silently create duplicate identities for the same person.

## Entitlement rules
- Entitlements must be verified server-side or through a trusted centralized entitlement service.
- Hiding UI is not authorization.
- Client-supplied role, plan, owner, project, trial, or entitlement claims must not be trusted without server verification.
- Heavy-service quotas must be enforced server-side.
- A project must deny paid access safely when entitlement verification fails or is unavailable.
- Admin overrides must be explicit, auditable, and protected by server-side authorization.

## Subscription lifecycle
Any change to subscription state must propagate to project access consistently, including activation, renewal, expiration, cancellation, suspension, refund/revocation, member removal, and project-only member reassignment where policy permits.

Subprojects must not keep stale paid access indefinitely after the central entitlement is revoked.

## Device/session policy
A هِمّة account follows the centrally approved device policy: one computer and one phone for the account unless a later approved policy changes it. Device/session limits belong to the central account policy, not independent project subscription systems.

## Integration contract
Subprojects may keep local project data such as progress, workouts, lessons, preferences, or child-safe content state, but account ownership and paid-access decisions must come from the central NAVIXA authority.

Recommended decision boundary:
Identity verification → Central entitlement check → Project authorization → Project-local data access

## Security and privacy requirements
All access-related endpoints must consider authentication, authorization, IDOR/broken access control, membership ownership, entitlement tampering, replay/stale-session behavior, rate limiting, auditability of privileged changes, and webhook/event authenticity.

Privacy takes priority. Do not collect payment-card data, unnecessary personal tracking data, or sensitive content merely to enforce entitlements. Store only the minimum operational metadata required.

## Change-control rule
No developer or AI agent may change this access model incidentally while implementing another feature. Any conflicting implementation is a bug or migration task, not a new source of truth.

Changes to this model require explicit product approval and coordinated updates across every affected NAVIXA repository.

## Golden rule
One identity model. One subscription authority. Public plans are هِمّة and عَزْم. Explicit project entitlements. No accidental cross-project access.