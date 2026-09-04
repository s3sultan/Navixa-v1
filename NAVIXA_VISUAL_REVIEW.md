# NAVIXA Visual Review

NAVIXA-owned visual review protocol for material engineering changes.

## Purpose
Turn complex code changes into the smallest useful explanation so a reviewer can understand the conclusion first, then what changed, where it changed, how data or control flow changed, what could break, and how the change was verified.

This protocol is an internal engineering aid. It must not add third-party branding, attribution, runtime dependencies, UI badges, or user-facing credits.

## Core principle: conclusion first, evidence nearby
Before drawing anything:
1. Define the exact analysis subject and scope.
2. Inspect enough repository/runtime evidence to support the conclusion.
3. State the core conclusion near the top.
4. Choose only the visual primitive that reduces cognitive load for this question.
5. Keep supporting code symbols, paths, state, or evidence close to the claim they support.

A repository-wide request starts with a high-level map and progressively narrows. A module or logic request starts directly at the relevant mechanism.

## Review modes
Choose the mode that matches the question:

### Understand current state
Show what exists and how it works: architecture/component tree, shallow file tree, call path, sequence, data transformation, or state path.

### Understand a change
Show semantic before/after behavior, affected scope, changed boundaries, and focused code evidence.

### Diagnose a problem
Show the expected path and actual path, then identify the first verified divergence point and its downstream effects. Do not jump from symptom to guessed root cause.

### Make a decision
Compare viable options using the same criteria: security, correctness, maintainability, performance, complexity, migration cost, rollback, and NAVIXA project boundaries. Recommend only after trade-offs are visible.

## When to use
Use Visual Review for material changes involving architecture/project boundaries; authentication, authorization, subscriptions, billing, or account access; APIs, database/data flow, webhooks, or integrations; navigation or major UI flows; shared components; migrations/deployment; risky refactors; incidents; or technical choices where a visual/comparison is clearer than prose.

Skip it for tiny edits where a visual adds no useful information.

## Required review sequence
1. **Context and scope**: what is being analyzed and what is intentionally outside scope.
2. **Core conclusion**: concise global judgment before detail.
3. **Before**: only the relevant current structure/behavior.
4. **Change or divergence**: intended change, or expected-vs-actual divergence during diagnosis.
5. **After / target state**: resulting structure/behavior and boundaries.
6. **Affected files/symbols**: only evidence-backed files, functions, components, routes, schemas, or services.
7. **Data / control path**: trigger to final effect, including validation and authorization where relevant.
8. **Risk map**: realistic regression, security, privacy, integrity, performance, and deployment risks, each marked verified, mitigated, accepted, or unresolved.
9. **Verification**: exact checks actually run and their results. Build success alone is not feature verification.
10. **Rollback**: known safe restore point or reversal method.

## Visual selection rule
Choose the smallest useful representation. Use one main view whenever possible and add a secondary view only when it changes the conclusion or next action.

Available primitives include:
- architecture/layer map for ownership and system boundaries
- compact ASCII component/file tree for structure
- call tree for runtime control flow
- data-flow or transformation chain for movement/change of data
- sequence diagram for multi-component/service interactions
- state path/diagram for lifecycle and transitions
- dependency map for coupling and impact
- database/schema or entity-relationship view when persistence relationships matter
- deployment map when runtime/deployment boundaries matter
- swimlane when responsibility across actors/systems matters
- timeline for incident/change chronology
- before/after table for policy, state, or behavioral changes
- focused diff excerpt when code itself is the clearest evidence

Do not create decorative diagrams or duplicate the same insight in several formats.

## Evidence discipline
- Bind important conclusions to real code symbols, repository paths, runtime observations, tests, logs, configuration, or deployment evidence.
- Explain runtime causality first: who acts, when, under what condition, what executes, and what result follows.
- Define unfamiliar technical terms once and use consistent names afterward.
- Keep diagram node labels compact; put detailed causality in nearby prose.
- Add links only when they directly help verification or navigation.
- Never invent filenames, APIs, commands, state, tests, deployments, or root causes.

## Security-sensitive reviews
For authentication, authorization, subscriptions, billing, admin actions, or user data, show where trust changes and enforcement happens.

Minimum questions:
- Who initiates the action?
- What identity/session is trusted?
- Where is authorization checked?
- What server-side resource is accessed or changed?
- Can another account or project cross the boundary?
- What happens on denial or failure?

Never present hidden UI, disabled buttons, route names, or client state as an authorization boundary.

## Multi-project NAVIXA rule
NAVIXA projects remain independently maintainable. A visual may show relationships between NAVIXA, Kids, English Learning, Fitness, Meetings, or future projects, but must not imply shared runtime code, permissions, or deployment unless repository evidence confirms it.

For centralized account/subscription flows, distinguish central identity/access decision, project-specific behavior, permitted project scope, and denied cross-project scope.

## RTL / LTR
Arabic process descriptions use left arrows:
`المستخدم ← NAVIXA ← التحقق ← الخدمة`

English process descriptions use right arrows:
`User → NAVIXA → Verification → Service`

For Mermaid, prioritize semantic correctness and readable labels.

## Compact template
### Context and scope
What is being analyzed and boundaries.

### Core conclusion
The verified answer in one concise paragraph.

### Main view
Use the smallest appropriate primitive.

### Evidence
- `path/symbol`: what it proves

### Risks / trade-offs
| Item | Status | Evidence / mitigation |
| --- | --- | --- |
| Regression | verified / unresolved | check |
| Security | verified / unresolved | boundary/check |
| Performance | verified / unresolved | measurement/check |
| Deployment | verified / unresolved | preview/rollback |

### Verification
- `actual command/check` → result

### Rollback
- Known stable commit, deployment, or reversal procedure.

## Completion rule
Visual Review is evidence, not decoration. A useful review lowers cognitive load without hiding necessary facts. Never claim a changed file, passed test, successful deployment, preserved behavior, root cause, or mitigated risk unless repository or runtime evidence supports it.