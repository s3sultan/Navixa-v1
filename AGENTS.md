# NAVIXA shared-agent instructions

Before every task, read `AI_ONBOARDING.md`, `PROJECT_MEMORY.md`, and `AI_WORKSPACE.md` completely.

Follow the coordination rules in `AI_WORKSPACE.md`. Do not edit files reserved by another active agent. Re-read `git status` and the target files immediately before editing because another assistant may have changed them.

After completing work:

1. Update `AI_WORKSPACE.md` with the completed stage, verification result, next proposed stage, and release all reservations.
2. Append one concise entry to `AI_CHANGELOG.md` describing the outcome and changed files.
3. Update `PROJECT_MEMORY.md` only when the user approves a durable product decision.

Never overwrite or revert another agent's changes unless the user explicitly requests it.
