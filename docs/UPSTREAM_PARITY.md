# Upstream Parity Notes (leonvanzyl/autocoder)

This fork diverges from upstream in both **repo structure** (`src/` layout, unified CLI, parallel orchestration) and **feature set**. Upstream commit hashes often won’t appear in this repo even when the *behavior* exists, because many changes were re-implemented or ported manually.

## Recently Reviewed Upstream Commits

### Ported (behavior present in this fork)

- `5068790` – `/expand-project` now persists features via `feature_create_bulk` (MCP) instead of emitting an unparsed JSON block.
- `29715f2` – Full **GSD → AutoCoder** skill + reference docs.
- `501719f` – UI design system refinements (tokens/classes/animations), ported with conflict resolution.
- `b2c19b0` / `780cfd3` – Auth error UX improvements: detect common auth failures and show actionable hints.
- `7f436a4` – Auto-continue now waits until the CLI rate-limit reset time when the agent responds with “Limit reached… Resets …”.
- `aede8f7` – Existing-project onboarding improvements: project name can differ from folder name; duplicate-path registrations are blocked.
- `f7da9d6` – Ignore stray Windows `nul` files in git.

### Superseded / Not Applicable (due to fork architecture)

- `dff28c5`, `17b7354`, `81dbc4b` – Upstream venv activation/WSL fixes in launcher scripts: this fork uses `pip install -e '.[dev]'` and launches via installed entry points (`autocoder`, `autocoder-ui`).
- `91cc00a` – `in_progress` boolean initialization: this fork uses `features.status` (`PENDING|IN_PROGRESS|DONE`) rather than an `in_progress` boolean field.

### Still To Review (may contain small deltas)

These are mostly UX polish / messaging tweaks and may be partially redundant with this fork:

- `2b2e28a` – “Limit reached” message formatting tweaks.
- `bc7970f` – env-based model override wiring (already applied in spec/expand; confirm assistant/reviewer paths).
- `334b655` – Move feature action buttons to the pending column header (this fork has a different header/settings layout).

## How To Use This Document

- Use it as a checklist when syncing new upstream changes.
- When porting, prefer **behavioral parity** over cherry-picking raw commits (paths, modules, and architecture differ).

