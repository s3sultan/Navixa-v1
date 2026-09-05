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

## Evidence-backed architecture map
Architecture views are claims about the system and therefore require evidence.

For every material node or relationship, retain enough evidence to answer:
- What repository path, symbol, configuration, schema, route, runtime observation, or deployment fact proves this node exists?
- What proves this connection or dependency exists?
- Is the relationship direct, inferred, conditional, external, or unresolved?

Rules:
- Never draw an architectural relationship only because it seems likely.
- Distinguish verified relationships from unresolved/inferred relationships when inference is necessary.
- Keep evidence references close to the relevant node or relationship.
- Prefer omission over unsupported certainty.
- Do not imply shared runtime code, data, permissions, or deployment across NAVIXA projects without evidence.

## Architecture delta: Before ← Delta ← After
For material architecture changes, explicitly model the delta instead of redrawing two opaque snapshots.

Classify each meaningful element or relationship as one of:
- **Added**: new node, boundary, dependency, route, data path, or responsibility.
- **Removed**: deleted or intentionally retired element/relationship.
- **Changed**: same conceptual element with changed behavior, contract, policy, trust, state, or responsibility.
- **Moved**: responsibility or component relocated without implying behavior stayed identical unless verified.
- **Rerouted**: control/data/dependency path now travels through a different verified path.
- **Unchanged**: important boundary explicitly preserved and verified.

Each delta item should include evidence and impact when material.

Arabic review flow:
`قبل ← الفرق ← بعد ← الدليل ← التأثير`

English review flow:
`Before → Delta → After → Evidence → Impact`

Do not label an item unchanged merely because its file was untouched. Behavior may change indirectly through dependencies, configuration, contracts, permissions, or data flow.

## When to use
Use Visual Review for material changes involving architecture/project boundaries; authentication, authorization, subscriptions, billing, or account access; APIs, database/data flow, webhooks, or integrations; navigation or major UI flows; shared components; migrations/deployment; risky refactors; incidents; or technical choices where a visual/comparison is clearer than prose.

Skip it for tiny edits where a visual adds no useful information.

## Required review sequence
1. **Context and scope**: what is being analyzed and what is intentionally outside scope.
2. **Core conclusion**: concise global judgment before detail.
3. **Before**: only the relevant current structure/behavior.
4. **Delta / divergence**: classify verified changes as Added, Removed, Changed, Moved, Rerouted, or Unchanged; for incidents show expected-vs-actual divergence.
5. **After / target state**: resulting structure/behavior and boundaries.
6. **Evidence**: attach real evidence to material nodes, relationships, and delta claims.
7. **Affected files/symbols**: only evidence-backed files, functions, components, routes, schemas, or services.
8. **Data / control path**: trigger to final effect, including validation and authorization where relevant.
9. **Impact and risk map**: direct and indirect impact plus realistic regression, security, privacy, integrity, performance, and deployment risks, each marked verified, mitigated, accepted, or unresolved.
10. **Verification**: exact checks actually run and their results. Build success alone is not feature verification.
11. **Rollback**: known safe restore point or reversal method.

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
- before/delta/after table for architectural or behavioral changes
- focused diff excerpt when code itself is the clearest evidence

Do not create decorative diagrams or duplicate the same insight in several formats.

## Evidence discipline
- Bind important conclusions to real code symbols, repository paths, runtime observations, tests, logs, configuration, or deployment evidence.
- Explain runtime causality first: who acts, when, under what condition, what executes, and what result follows.
- Define unfamiliar technical terms once and use consistent names afterward.
- Keep diagram node labels compact; put detailed causality in nearby prose.
- Add links only when they directly help verification or navigation.
- Never invent filenames, APIs, commands, state, tests, deployments, relationships, or root causes.

## Security-sensitive reviews
For authentication, authorization, subscriptions, billing, admin actions, or user data, show where trust changes and enforcement happens.

Minimum questions:
- Who initiates the action?
- What identity/session is trusted?
- Where is authorization checked?
- What server-side resource is accessed or changed?
- Can another account or project cross the boundary?
- What happens on denial or failure?
- Did the delta add, remove, move, or reroute a trust boundary?

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

### Before
Relevant verified architecture or behavior.

### Delta
| Element / relationship | Classification | Evidence | Impact |
| --- | --- | --- | --- |
| item | Added / Removed / Changed / Moved / Rerouted / Unchanged | path/symbol/check | direct/indirect impact |

### After
Resulting verified architecture or behavior.

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
Visual Review is evidence, not decoration. A useful review lowers cognitive load without hiding necessary facts. Never claim a node, relationship, delta classification, changed file, passed test, successful deployment, preserved behavior, root cause, or mitigated risk unless repository or runtime evidence supports it.