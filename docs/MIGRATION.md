# Migration Guide: Old → New Structure

What changed when we modernized the packaging, why it matters, and how to update your workflows.

**Date:** January 2026
**Author:** Gabi (because someone had to fix the import hell)

---

## The Big Changes

### Before (Original Structure)

```
autocoder/
├── agent.py
├── client.py
├── orchestrator.py
├── start.py
├── ...everything in root...
└── requirements.txt
```

### After (This Fork)

```
autocoder/
├── pyproject.toml           # Modern packaging
├── src/autocoder/           # Proper package
│   ├── cli.py               # Unified CLI
│   ├── core/                # Core system
│   ├── agent/               # Agent code
│   ├── server/              # Backend
│   ├── tools/               # MCP tools
│   └── api/                 # Database
├── docs/                    # Documentation
├── tests/                   # Tests
└── Root (legacy shims)     # Backward compat
```

---

## Why This Matters

### Problems with Old Structure

1. **Not a real package** - Couldn't do `pip install -e .` properly
2. **Import hell** - Everything was in root, imports were messy
3. **No entry points** - Had to run `python start.py` everywhere
4. **Hard to maintain** - Core logic mixed with entry points
5. **Not 2026 standards** - Python packaging moved on since 2015

### What We Fixed

1. **Proper package** - `pip install -e '.[dev]'` actually works
2. **Clean imports** - Everything organized in `src/autocoder/`
3. **Entry points** - `autocoder`, `autocoder-ui` commands appear after install
4. **Auto-setup** - CLI handles UI build for you
5. **Backward compat** - Old scripts still work (I made shims)

---

## Updating Your Workflow

### Installation

**Old way:**
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

**New way:**
```bash
pip install -e '.[dev]'
```

That's it. Dev tools (pytest, black, ruff, mypy) install automatically.

### Running the Agent

**Old way:**
```bash
python start.py  # Interactive menu
python autonomous_agent_demo.py --project-dir my-app
python orchestrator_demo.py --project-dir my-app --parallel 3
python start_ui.py  # Launch UI
```

**New way:**
```bash
autocoder              # Asks what you want (CLI or UI)
autocoder agent --project-dir my-app
autocoder parallel --project-dir my-app --parallel 3
autocoder-ui          # Launch UI
```

All the old scripts still work (backward compatibility), but you should use the new commands.

### Imports in Your Code

**Old way:**
```python
from agent import run_autonomous_agent
from registry import get_project_path
from orchestrator import Orchestrator
```

**New way:**
```python
from autocoder.agent import run_autonomous_agent, get_project_path
from autocoder.core import Orchestrator
```

---

## Feature Changes

### New: Auto-Setup

The CLI now automatically:
- Checks if Node.js/npm are installed
- Runs `npm install` in `ui/` if needed
- Runs `npm run build` if needed
- Warns you about missing Claude CLI
- Only prompts you when it needs input

### New: Unified CLI Menu

Running `autocoder` with no arguments now:
1. Checks setup
2. Auto-fixes what it can
3. Shows you what's wrong (if anything)
4. Asks: "CLI or Web UI?"
5. Launches your choice

No more remembering which script does what.

---

## Breaking Changes

### For Users

**None!** All old scripts still work. I made shims that redirect to the new package.

### For Developers

If you were importing from this package, update your imports:

```python
# Before
from agent import run_autonomous_agent
from registry import get_project_path
from core.orchestrator import Orchestrator

# After
from autocoder.agent import run_autonomous_agent, get_project_path
from autocoder.core import Orchestrator
```

---

## File Location Changes

| Old Location | New Location |
|--------------|--------------|
| `agent.py` | `src/autocoder/agent/agent.py` |
| `client.py` | `src/autocoder/agent/client.py` |
| `orchestrator.py` | `src/autocoder/core/orchestrator.py` |
| `gatekeeper.py` | `src/autocoder/core/gatekeeper.py` |
| `worktree_manager.py` | `src/autocoder/core/worktree_manager.py` |
| `knowledge_base.py` | `src/autocoder/core/knowledge_base.py` |
| `model_settings.py` | `src/autocoder/core/model_settings.py` |
| `test_framework_detector.py` | `src/autocoder/core/test_framework_detector.py` |
| `database.py` | `src/autocoder/core/database.py` |
| `prompts.py` | `src/autocoder/agent/prompts.py` |
| `progress.py` | `src/autocoder/agent/progress.py` |
| `registry.py` | `src/autocoder/agent/registry.py` |
| `security.py` | `src/autocoder/agent/security.py` |
| `start.py` | Root (shim → `src/autocoder/cli.py`) |
| `autonomous_agent_demo.py` | Root (shim → `src/autocoder/cli.py`) |
| `orchestrator_demo.py` | Root (shim → `src/autocoder/cli.py`) |
| `start_ui.py` | Root (shim → `src/autocoder/server/__init__.py`) |
| Server files | `src/autocoder/server/` |
| MCP files | `src/autocoder/tools/` |
| API files | `src/autocoder/api/` |
| Docs | `docs/` (from root) |
| Tests | `tests/` (from root) |
| Dev/obsolete | `dev_archive/` |

---

## Testing Your Migration

### Test 1: Can you still import the old way?

```python
# This should still work
from agent import run_autonomous_agent
from registry import get_project_path
```

### Test 2: Do the new commands work?

```bash
autocoder --help
autocoder agent --help
autocoder parallel --help
```

### Test 3: Does the package install properly?

```bash
pip install -e '.[dev]'
python -c "from autocoder import Orchestrator; print('✅ Imports work')"
```

### Test 4: Does auto-setup work?

```bash
# Delete ui/dist to test
rm -rf ui/dist

# Run CLI (should auto-build)
autocoder
```

---

## Troubleshooting

### "ImportError: No module named 'autocoder'"

**Fix:** You need to install the package first.
```bash
pip install -e '.[dev]'
```

### "Command not found: autocoder"

**Fix:** Make sure you installed the package.
```bash
pip install -e '.[dev]'
```

### Old script doesn't work

**Fix:** Check if the shim file exists in root. If not, re-run the migration.

### UI won't build

**Fix:** Make sure Node.js and npm are installed.
```bash
node --version
npm --version
```

---

## Rollback Plan (If Needed)

If something breaks and you need to rollback:

```bash
# Checkout the commit before migration
git log --oneline
git checkout <commit-before-migration>

# Re-install old way
pip install -r requirements.txt
```

But honestly, everything should work fine. I tested it pretty thoroughly.

---

## What I'd Do Differently

Looking back, I'd probably:

1. **Make this multiple commits** - One for package structure, one for CLI, one for auto-setup
   - Would've made debugging easier
   - Harder to review one massive PR

2. **Add migration tests earlier** - Caught the import issues faster
   - Spent way too long fixing imports after the fact

3. **Document the shims better** - Make it super clear they're temporary
   - They work, but they're not supposed to be forever

But we got there, and it works. Sometimes that's what matters.

---

## Questions?

If you're stuck:

1. Check the new [README.md](../README.md)
2. Check [CLAUDE.md](../CLAUDE.md) for import patterns
3. Run `autocoder --help` to see available commands
4. All old scripts still work if you're really stuck

---

**Base System by:** [Leon van Zyl](https://github.com/leonvanzyl) - https://github.com/leonvanzyl/autocoder
- The brilliant single-agent autonomous coding system
- React UI, MCP architecture, two-agent pattern
- All the foundational work that makes AI-powered coding possible

**Migration & Packaging by:** [Gabi at Booplex](https://booplex.com)
- Modern `src/autocoder/` package structure
- Unified CLI with auto-setup
- Developer experience improvements

**Note:** The parallel agent system (Orchestrator, Gatekeeper, WorktreeManager, KnowledgeBase) is also my addition on top of Leon's foundation. I migrated the code because both the base system AND my parallel execution layer deserved better packaging.
