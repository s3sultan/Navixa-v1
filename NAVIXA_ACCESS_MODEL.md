# NAVIXA Central Access Model

This document is the authoritative product rule for accounts, subscriptions, memberships, and project entitlements across the NAVIXA ecosystem.

## Central authority
NAVIXA main is the source of truth for:
- account identity
- subscription state
- membership ownership
- project entitlements
- device/session policy
- admin overrides

NAVIXA Kids, NAVIXA English Learning, and NAVIXA Fitness must not create an independent subscription model that contradicts or bypasses this authority.

Arabic flow:
NAVIXA الرئيسي ← الحساب ← الاشتراك ← العضوية ← صلاحيات المشاريع

English flow:
NAVIXA Main → Account → Subscription → Membership → Project Entitlements

## Access types
### 1. Primary Plus owner
The primary Plus subscriber may access:
- NAVIXA main
- NAVIXA Kids
- NAVIXA English Learning
- NAVIXA Fitness

### 2. One comprehensive additional member
A Plus owner may add one additional member with a separate email.

This member receives access to:
- NAVIXA main
- NAVIXA Kids
- NAVIXA English Learning
- NAVIXA Fitness

The additional member must not gain subscription-owner privileges such as managing members, purchasing member slots on behalf of the owner, or changing ownership-level subscription settings unless explicitly granted by a later approved policy.

### 3. One paid project-only additional member
A Plus owner may add one paid project-only member with a separate email.

At creation time exactly one project must be selected:
- NAVIXA Kids
- NAVIXA English Learning
- NAVIXA Fitness

This membership grants access only to the selected project. It must not unlock NAVIXA main or any other project.

### 4. Kids child profiles
The Plus owner may have up to two child profiles for NAVIXA Kids according to the approved product model.

Child profiles are scoped to NAVIXA Kids and must not inherit adult/admin/subscription-management permissions.

## Identity uniqueness
- Membership is tied to a distinct email/account identity where email identity applies.
- The same email must not be active under two different subscription owners at the same time unless a later explicit migration or transfer policy allows it.
- Project applications must not silently create duplicate identities for the same person.

## Entitlement rules
- Entitlements must be verified server-side or through a trusted centralized entitlement service.
- Hiding UI is not authorization.
- Client-supplied role, plan, owner, project, or entitlement claims must not be trusted without server verification.
- A project must deny access safely when entitlement verification fails or is unavailable.
- Admin overrides must be explicit, auditable, and protected by server-side authorization.

## Subscription lifecycle
Any change to subscription state must propagate to project access consistently, including:
- activation
- renewal
- expiration
- cancellation
- suspension
- refund/revocation where applicable
- member removal
- project-only member reassignment where policy permits

Subprojects must not keep stale paid access indefinitely after the central entitlement is revoked.

## Device/session policy
Device/session limits belong to the central account policy, not to independent project-specific subscription systems. Projects may enforce the centrally approved policy but must not invent conflicting limits.

## Integration contract
Subprojects may keep local project data such as progress, workouts, lessons, preferences, or child-safe content state, but account ownership and paid-access decisions must come from the central NAVIXA authority.

Recommended decision boundary:
Identity verification → Central entitlement check → Project authorization → Project-local data access

Arabic equivalent:
التحقق من الهوية ← التحقق المركزي من الاستحقاق ← صلاحية المشروع ← بيانات المشروع المحلية

## Security requirements
All access-related endpoints must consider:
- authentication
- authorization
- IDOR/broken access control
- membership ownership
- entitlement tampering
- replay/stale-session behavior
- rate limiting where appropriate
- auditability of privileged changes
- webhook/event authenticity when subscription state is updated externally

## Change-control rule
No developer or AI agent may change this access model incidentally while implementing another feature. Any conflicting implementation must be treated as a bug or migration task, not as a new source of truth.

Changes to this model require explicit product approval and coordinated updates across every affected NAVIXA repository.

## Golden rule
One identity model. One subscription authority. Explicit project entitlements. No accidental cross-project access.