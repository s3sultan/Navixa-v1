# NAVIXA Automation Core

This module is the internal execution foundation for NAVIXA automations. It deliberately stays separate from the UI so product features can evolve without coupling pages to execution details.

## Boundaries

`lib/navixa-core` contains three layers:

1. **Skills Architecture**: `SkillRegistry` registers small capabilities by stable IDs such as `summary.create`, `notifications.send`, or future health/listening actions.
2. **Automation Engine**: `AutomationEngine` resolves a skill, creates a run, executes it, and records the final outcome.
3. **Run History**: `RunHistoryStore` is the storage contract. `InMemoryRunHistoryStore` is the first adapter and can later be replaced by D1/Drizzle without changing the engine.

The core does not render UI, read cookies, own credentials, schedule cron jobs, or call external providers directly. Those concerns belong in adapters around the core.

## Execution flow

```text
NAVIXA feature / trigger
        ↓
AutomationDefinition
        ↓
AutomationEngine
   ↙             ↘
SkillRegistry    RunHistoryStore
   ↓             ↓
Skill.execute    queued → running → succeeded / failed
                             ↘ skipped when disabled
```

Every enabled attempt is recorded before skill execution. Missing skills and execution errors become failed runs instead of disappearing. Disabled automations are recorded as skipped and never invoke their skill.

Only the error name and message are stored by the core. Stack traces are intentionally excluded from run history.

## Trigger model

The first contract supports:

- `manual`
- `schedule` with a schedule expression supplied by a future scheduler adapter
- `event` with an event name supplied by a future event/webhook adapter

The engine executes an automation after a trigger has been selected. It does not itself keep a timer or listen for webhooks.

## Migration path for NAVIXA features

Existing product features should move gradually, not through a rewrite. Good candidates include:

- listen and summarize → one or more skills
- name detection notification → event-triggered automation
- Telegram / Web Push delivery → notification skills or adapters
- weekly summary → scheduled automation
- future mobile remote actions → permission-gated skills

Each migration should preserve the current user-facing behavior and privacy boundary.

## Persistence

`InMemoryRunHistoryStore` is intentionally non-persistent and is suitable for tests and local composition. The next storage adapter can implement `RunHistoryStore` using the repository's existing Drizzle/D1 infrastructure. The engine and skills API should not need to change.

## Security expectations

- Validate untrusted inputs before privileged skill execution.
- Keep secrets outside automation definitions and run history.
- Apply authentication and authorization before dispatching account-scoped or admin skills.
- Keep local-only privacy features local unless the product explicitly defines a safe server boundary.
- Use isolation for future skills that can access files, devices, or operating-system capabilities.
