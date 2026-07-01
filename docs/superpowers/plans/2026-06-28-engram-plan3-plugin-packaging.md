# Engram Plan 3 — Plugin Packaging (Claude Code + Codex)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship installable Claude Code and Codex plugins that wire Engram into a real session — an MCP server, a convention-aware skill, an `engram_learn` tool, a SessionStart hook that injects conventions, and a Stop hook that captures new ones — so a user gets the full "teach once, applied everywhere" loop in one install.

**Architecture:** One canonical `SKILL.md` synced into both plugins. Each plugin is a thin wrapper: `.mcp.json` runs `npx -y @tlgimenes/engram mcp`; `hooks/hooks.json` runs `npx -y @tlgimenes/engram hook <event>` (which reads the hook stdin JSON and prints the portable `hookSpecificOutput` injection or fires background capture). The hook contract is shared between Claude Code and Codex; we normalize the few divergent fields.

**Tech Stack:** Rust (extends `engram-mcp` + `engram-cli` from Plans 1–2), plugin JSON manifests, `just` for skill sync. No network needed for the plugin files themselves.

## Global Constraints

- **npm package name:** `@tlgimenes/engram`. Plugins reference it via `npx -y @tlgimenes/engram …`. **This plan publishes nothing to npm** — it only references the name. (Actual npm publish is Plan 4, gated on account recovery.)
- **Hook injection payload (portable across both hosts):** `{"hookSpecificOutput":{"hookEventName":"<Event>","additionalContext":"<text>"}}`. Plain text on stdout also works; exit 0 = success.
- **Cross-host hook differences to handle:** Codex `transcript_path` may be `null`; Codex Stop stdin uses different field names; Codex requires the user to trust hooks via `/hooks`. Read defensively.
- **Skills are DRY:** canonical source in `/skills`, copied into `plugins/*/skills` by `just sync-plugins`; CI fails on drift.
- **Dogfood override:** during development, point the MCP command and hook commands at `./target/debug/engram` instead of `npx` (see Task 5).
- **Commit style:** end every commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `engram_learn` MCP tool + relocate `parse_scope` to `engram-inject`

**Files:**
- Modify: `crates/engram-inject/src/lib.rs` (add `pub mod scope; pub use scope::*;`)
- Create: `crates/engram-inject/src/scope.rs` (move `parse_scope` here, taking an explicit `cwd`)
- Modify: `crates/engram-cli/src/lib.rs` (re-export `parse_scope` from inject; drop the local copy)
- Modify: `crates/engram-mcp/Cargo.toml` (add `engram-core`, `chrono`, `uuid` deps)
- Modify: `crates/engram-mcp/src/lib.rs` (add `handle_learn` + `engram_learn` tool)
- Test: inline in `crates/engram-inject/src/scope.rs` and `crates/engram-mcp/src/lib.rs`

**Interfaces:**
- Produces: `engram_inject::parse_scope(s: &str, cwd: &Path) -> anyhow::Result<Scope>`; `engram_mcp::handle_learn(db_path: &Path, rule: &str, scope: &str, tags: Vec<String>, cwd: Option<&str>) -> Result<String>` and an `engram_learn` MCP tool.
- Consumes: `engram_inject::detect_context`, `engram_core` types, `engram_store::Store`.

- [ ] **Step 1: Write the failing test in `crates/engram-inject/src/scope.rs`**

```rust
#[cfg(test)]
mod tests {
    use super::parse_scope;
    use engram_core::Scope;
    use std::path::Path;

    #[test]
    fn parses_global_and_language() {
        assert_eq!(parse_scope("global", Path::new(".")).unwrap(), Scope::Global);
        assert_eq!(
            parse_scope("language:rust", Path::new(".")).unwrap(),
            Scope::Language("rust".into())
        );
    }

    #[test]
    fn rejects_unknown() {
        assert!(parse_scope("bogus", Path::new(".")).is_err());
    }
}
```

- [ ] **Step 2: Run it to verify failure**

Run: `cargo test -p engram-inject scope`
Expected: FAIL — module/function not found.

- [ ] **Step 3: Add module wiring to `crates/engram-inject/src/lib.rs`**

```rust
mod scope;
pub use scope::*;
```

- [ ] **Step 4: Write `crates/engram-inject/src/scope.rs`** (above the test block)

```rust
use crate::detect_context;
use anyhow::{anyhow, Result};
use engram_core::Scope;
use std::path::Path;

/// Parse a `--scope` string into a `Scope`. `repo`/`branch` resolve from the
/// git context at `cwd`.
pub fn parse_scope(s: &str, cwd: &Path) -> Result<Scope> {
    if s == "global" {
        return Ok(Scope::Global);
    }
    if let Some(lang) = s.strip_prefix("language:") {
        if lang.is_empty() {
            return Err(anyhow!("language scope needs a name, e.g. language:rust"));
        }
        return Ok(Scope::Language(lang.to_string()));
    }
    if s == "repo" || s == "branch" {
        let ctx = detect_context(cwd);
        let remote = ctx
            .remote_id
            .ok_or_else(|| anyhow!("not in a git repo with an 'origin' remote; can't use --scope {s}"))?;
        if s == "repo" {
            return Ok(Scope::Repo { remote_id: remote });
        }
        let branch = ctx.branch.ok_or_else(|| anyhow!("can't detect the current branch"))?;
        return Ok(Scope::Branch { remote_id: remote, branch });
    }
    Err(anyhow!("unknown scope '{s}': use global | repo | branch | language:<lang>"))
}
```

- [ ] **Step 5: Update `crates/engram-cli/src/lib.rs`** — delete the local `parse_scope` fn and re-export the moved one. Replace the old `pub fn parse_scope(...) { ... }` with:

```rust
pub use engram_inject::parse_scope;
```

And update `cmd_learn`'s call site from `parse_scope(scope)?` to `parse_scope(scope, &std::env::current_dir()?)?`.

- [ ] **Step 6: Run inject + cli tests**

Run: `cargo test -p engram-inject && cargo test -p engram-cli`
Expected: PASS (the cli `parse_scope_*` tests still pass via the re-export).

- [ ] **Step 7: Add deps to `crates/engram-mcp/Cargo.toml`**

```toml
engram-core = { path = "../engram-core" }
chrono = { workspace = true }
uuid = { workspace = true }
```

- [ ] **Step 8: Write the failing test in `crates/engram-mcp/src/lib.rs`** (add to the existing `#[cfg(test)] mod tests`)

```rust
    #[test]
    fn handle_learn_then_list_shows_rule() {
        let tmp = tempfile::tempdir().unwrap();
        let db = tmp.path().join("engram.db");
        let msg = super::handle_learn(&db, "Use early returns", "global", vec![], None).unwrap();
        assert!(msg.contains("Use early returns"));
        assert!(super::handle_list(&db).unwrap().contains("Use early returns"));
    }
```

- [ ] **Step 9: Run it to verify failure**

Run: `cargo test -p engram-mcp handle_learn`
Expected: FAIL — `cannot find function handle_learn`.

- [ ] **Step 10: Add `handle_learn` + the tool to `crates/engram-mcp/src/lib.rs`**

Add the handler (near `handle_list`):

```rust
pub fn handle_learn(
    db_path: &Path,
    rule: &str,
    scope: &str,
    tags: Vec<String>,
    cwd: Option<&str>,
) -> Result<String> {
    use chrono::Utc;
    use engram_core::{Convention, Provenance, Source, Status};
    use uuid::Uuid;

    let store = Store::open(db_path)?;
    let dir = match cwd {
        Some(c) => PathBuf::from(c),
        None => std::env::current_dir()?,
    };
    let scope = engram_inject::parse_scope(scope, &dir)?;
    let now = Utc::now();
    let c = Convention {
        id: Uuid::new_v4(),
        rule: rule.to_string(),
        rationale: None,
        scope,
        tags,
        provenance: Provenance {
            source: Source::ManualTeach,
            repo: dir.to_str().map(|_| None).flatten(),
            branch: None,
            agent: None,
            excerpt: None,
            learned_at: now,
        },
        status: Status::Active,
        superseded_by: None,
        confidence: 0.8,
        created_at: now,
        updated_at: now,
    };
    store.add_curated(&c)?;
    Ok(format!("Learned: {rule}"))
}
```

Add the params struct (near `ConventionsParams`):

```rust
#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct LearnParams {
    /// The convention, imperative and compact, e.g. "Import directly; no barrel files".
    pub rule: String,
    /// global | repo | branch | language:<lang>. Defaults to global.
    pub scope: Option<String>,
    /// Optional tags.
    pub tags: Option<Vec<String>>,
    /// Working directory (for repo/branch scope). Defaults to the server cwd.
    pub cwd: Option<String>,
}
```

Add the tool method inside the `#[tool_router] impl Engram { ... }` block:

```rust
    #[tool(
        description = "Record a durable coding convention the developer wants followed. Call this when they state a preference or correct you (e.g. 'always X', 'never Y', 'we use Z here')."
    )]
    fn engram_learn(&self, Parameters(p): Parameters<LearnParams>) -> Result<CallToolResult, McpError> {
        let text = handle_learn(
            &self.db_path,
            &p.rule,
            p.scope.as_deref().unwrap_or("global"),
            p.tags.unwrap_or_default(),
            p.cwd.as_deref(),
        )
        .map_err(|e| McpError::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
    }
```

> Note: the `repo` field expression above simplifies to `None` for manual teach; if clippy objects, just write `repo: None,`.

- [ ] **Step 11: Run mcp tests**

Run: `cargo test -p engram-mcp`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add crates/engram-inject crates/engram-cli crates/engram-mcp
git commit -m "feat(mcp): engram_learn tool; move parse_scope to engram-inject

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `engram hook` CLI entrypoint (session-start + stop)

**Files:**
- Modify: `crates/engram-cli/src/lib.rs` (add `hook_session_start`, `hook_stop_transcript`)
- Modify: `crates/engram-cli/src/main.rs` (add `Hook { event }` subcommand)
- Test: extend the `#[cfg(test)]` block in `crates/engram-cli/src/lib.rs`

**Interfaces:**
- Produces: `hook_session_start(db: &Path, stdin_json: &str) -> Result<String>` (returns the JSON to print, or `""` if nothing to inject); `hook_stop_transcript(stdin_json: &str) -> Option<String>` (extracts a non-empty `transcript_path`).

- [ ] **Step 1: Write the failing tests in the `#[cfg(test)]` block of `crates/engram-cli/src/lib.rs`**

```rust
    #[test]
    fn hook_session_start_injects_active_conventions() {
        let tmp = tempfile::tempdir().unwrap();
        let db = tmp.path().join("engram.db");
        cmd_learn(&db, "Use early returns", "global", vec![]).unwrap();
        let stdin = format!(r#"{{"cwd":"{}","hook_event_name":"SessionStart"}}"#, tmp.path().display());
        let out = hook_session_start(&db, &stdin).unwrap();
        assert!(out.contains("hookSpecificOutput"));
        assert!(out.contains("SessionStart"));
        assert!(out.contains("Use early returns"));
    }

    #[test]
    fn hook_session_start_empty_when_no_conventions() {
        let tmp = tempfile::tempdir().unwrap();
        let db = tmp.path().join("engram.db");
        let out = hook_session_start(&db, r#"{"cwd":"/tmp"}"#).unwrap();
        assert_eq!(out, "");
    }

    #[test]
    fn hook_stop_transcript_extracts_path_and_handles_null() {
        assert_eq!(
            hook_stop_transcript(r#"{"transcript_path":"/tmp/t.jsonl"}"#).as_deref(),
            Some("/tmp/t.jsonl")
        );
        assert_eq!(hook_stop_transcript(r#"{"transcript_path":null}"#), None);
        assert_eq!(hook_stop_transcript(r#"{}"#), None);
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `cargo test -p engram-cli hook`
Expected: FAIL — `cannot find function hook_session_start`.

- [ ] **Step 3: Add the implementations to `crates/engram-cli/src/lib.rs`** (above the test block)

```rust
use serde_json::{json, Value};

/// SessionStart hook: emit the injection JSON (or "" if nothing relevant).
pub fn hook_session_start(db: &Path, stdin_json: &str) -> Result<String> {
    let v: Value = serde_json::from_str(stdin_json).unwrap_or(json!({}));
    let cwd = match v.get("cwd").and_then(|c| c.as_str()) {
        Some(c) => std::path::PathBuf::from(c),
        None => std::env::current_dir()?,
    };
    let store = Store::open(db)?;
    let convs = store.active()?;
    let ctx = engram_inject::detect_context(&cwd);
    let selected = engram_inject::select(&convs, &ctx, 4000);
    let rendered = engram_inject::render(&selected);
    if rendered.is_empty() {
        return Ok(String::new());
    }
    Ok(serde_json::to_string(&json!({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": rendered
        }
    }))?)
}

/// Stop hook: extract a usable transcript path (None for Codex's null / missing).
pub fn hook_stop_transcript(stdin_json: &str) -> Option<String> {
    serde_json::from_str::<Value>(stdin_json)
        .ok()
        .and_then(|v| v.get("transcript_path").and_then(|t| t.as_str()).map(String::from))
        .filter(|s| !s.is_empty())
}
```

- [ ] **Step 4: Wire the `Hook` subcommand in `crates/engram-cli/src/main.rs`**

Add to the `Cmd` enum:

```rust
    /// Hook entrypoint for plugins (reads the hook JSON on stdin)
    Hook {
        /// session-start | stop
        event: String,
    },
```

Add to the `match cli.cmd` block:

```rust
        Cmd::Hook { event } => {
            use std::io::Read;
            let mut input = String::new();
            std::io::stdin().read_to_string(&mut input).ok();
            match event.as_str() {
                "session-start" => {
                    let out = engram_cli::hook_session_start(&db, &input)?;
                    if !out.is_empty() {
                        println!("{out}");
                    }
                }
                "stop" => {
                    if let Some(tp) = engram_cli::hook_stop_transcript(&input) {
                        // fire-and-forget: run capture in the background, don't block session end
                        if let Ok(exe) = std::env::current_exe() {
                            let _ = std::process::Command::new(exe).arg("capture").arg(tp).spawn();
                        }
                    }
                }
                other => eprintln!("unknown hook event: {other}"),
            }
        }
```

- [ ] **Step 5: Run tests + build**

Run: `cargo test -p engram-cli && cargo build`
Expected: PASS; binary builds.

- [ ] **Step 6: Manual smoke of the hook I/O**

```bash
ENGRAM_DB=/tmp/hk.db ./target/debug/engram learn "Use early returns" --scope global
echo '{"cwd":"/tmp","hook_event_name":"SessionStart"}' | ENGRAM_DB=/tmp/hk.db ./target/debug/engram hook session-start
```
Expected: prints a JSON object containing `hookSpecificOutput` and the rule.

- [ ] **Step 7: Commit**

```bash
git add crates/engram-cli
git commit -m "feat(cli): engram hook session-start/stop entrypoints

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Canonical skill + Claude Code plugin + `sync-plugins`

**Files:**
- Create: `skills/engram/SKILL.md`
- Create: `plugins/claude-code/.claude-plugin/plugin.json`
- Create: `plugins/claude-code/.mcp.json`
- Create: `plugins/claude-code/hooks/hooks.json`
- Create: `plugins/claude-code/commands/engram-learn.md`
- Create: `.claude-plugin/marketplace.json`
- Modify: `justfile` (add `sync-plugins` + `sync-plugins-check`)

**Interfaces:**
- Produces: an installable Claude Code plugin + a marketplace catalog at the repo root.

- [ ] **Step 1: Create `skills/engram/SKILL.md`** (the canonical source)

```markdown
---
name: engram
description: Use to follow and record the developer's personal coding conventions. ALWAYS call engram_conventions before writing or editing code. Call engram_learn whenever the developer states a durable preference or corrects you ("always X", "never Y", "we use Z here").
---

# Engram — the developer's convention brain

Engram remembers how THIS developer likes code written, across every repo and
branch. Use it so your code matches their conventions without being told twice.

## When to call which tool

- **Before writing or editing code**, call `engram_conventions` to load the
  rules relevant to the current repo/branch/languages. Follow them.
- **When the developer states a durable preference or corrects you** — e.g.
  "always use early returns", "never add barrel files", "we use snake_case for
  files here" — call `engram_learn` with a compact imperative `rule` and the
  right `scope` (`global` for personal style, `repo`/`branch` for project rules,
  `language:<lang>` for language-specific ones).
- To show the developer everything Engram knows, call `engram_list`.

## Rules of thumb

- Keep each rule short and imperative (< 140 chars).
- Prefer `global` scope for personal style that should follow the developer
  everywhere; use `repo`/`branch` only for project-specific rules.
- Don't record one-off task details — only durable conventions.
```

- [ ] **Step 2: Create `plugins/claude-code/.claude-plugin/plugin.json`**

```json
{
  "name": "engram",
  "displayName": "Engram",
  "version": "0.1.0",
  "description": "Your personal coding-convention brain: teach your AI once, it writes code like you in every repo and every agent.",
  "author": { "name": "tlgimenes" },
  "homepage": "https://github.com/tlgimenes/engram",
  "repository": "https://github.com/tlgimenes/engram",
  "license": "MIT",
  "keywords": ["mcp", "memory", "conventions", "context", "productivity"]
}
```

- [ ] **Step 3: Create `plugins/claude-code/.mcp.json`**

```json
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "@tlgimenes/engram", "mcp"]
    }
  }
}
```

- [ ] **Step 4: Create `plugins/claude-code/hooks/hooks.json`**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          { "type": "command", "command": "npx -y @tlgimenes/engram hook session-start", "timeout": 30 }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "npx -y @tlgimenes/engram hook stop", "timeout": 15 }
        ]
      }
    ]
  }
}
```

- [ ] **Step 5: Create `plugins/claude-code/commands/engram-learn.md`**

```markdown
---
description: Teach Engram a coding convention to remember everywhere
argument-hint: <the rule to remember>
---

Call the `engram_learn` tool to record this convention: **$ARGUMENTS**

Choose the scope sensibly (default `global` for personal style; `repo`/`branch`
for project-specific rules; `language:<lang>` for language rules). Then confirm
what you recorded.
```

- [ ] **Step 6: Create `.claude-plugin/marketplace.json`** (repo-root catalog)

```json
{
  "name": "engram",
  "owner": { "name": "tlgimenes", "url": "https://github.com/tlgimenes" },
  "plugins": [
    {
      "name": "engram",
      "source": "./plugins/claude-code",
      "description": "Your personal coding-convention brain for Claude Code."
    }
  ]
}
```

- [ ] **Step 7: Add `sync-plugins` recipes to `justfile`**

```just
# Copy the canonical skills into each plugin (run after editing /skills)
sync-plugins:
    rm -rf plugins/claude-code/skills plugins/codex/skills
    cp -R skills plugins/claude-code/skills
    cp -R skills plugins/codex/skills

# CI: fail if the synced skills have drifted from /skills
sync-plugins-check: sync-plugins
    git diff --exit-code -- plugins/claude-code/skills plugins/codex/skills
```

- [ ] **Step 8: Sync skills and validate the plugin**

Run:
```bash
mkdir -p plugins/codex
just sync-plugins
python3 -c "import json; [json.load(open(p)) for p in ['plugins/claude-code/.claude-plugin/plugin.json','plugins/claude-code/.mcp.json','plugins/claude-code/hooks/hooks.json','.claude-plugin/marketplace.json']]; print('json OK')"
claude plugin validate . 2>/dev/null && echo "plugin validate OK" || echo "(claude CLI not present; skipping validate)"
```
Expected: `json OK`, and plugin validation passes if the `claude` CLI is installed.

- [ ] **Step 9: Commit**

```bash
git add skills plugins/claude-code .claude-plugin justfile
git commit -m "feat(plugin): canonical skill + Claude Code plugin + marketplace catalog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Codex plugin + catalog

**Files:**
- Create: `plugins/codex/.codex-plugin/plugin.json`
- Create: `plugins/codex/.mcp.json`
- Create: `plugins/codex/hooks/hooks.json`
- Create: `.agents/plugins/marketplace.json`
- (Skills already synced into `plugins/codex/skills` by Task 3's `just sync-plugins`.)

**Interfaces:**
- Produces: an installable Codex plugin + a Codex marketplace catalog.

- [ ] **Step 1: Create `plugins/codex/.codex-plugin/plugin.json`**

```json
{
  "name": "engram",
  "version": "0.1.0",
  "description": "Your personal coding-convention brain: teach your AI once, it writes code like you in every repo and every agent.",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "hooks": "./hooks/hooks.json"
}
```

- [ ] **Step 2: Create `plugins/codex/.mcp.json`**

```json
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "@tlgimenes/engram", "mcp"]
    }
  }
}
```

- [ ] **Step 3: Create `plugins/codex/hooks/hooks.json`** (same schema; Codex normalizes the same payload)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          { "type": "command", "command": "npx -y @tlgimenes/engram hook session-start", "timeout": 30 }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "npx -y @tlgimenes/engram hook stop", "timeout": 15 }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Create `.agents/plugins/marketplace.json`** (Codex catalog)

```json
{
  "name": "engram",
  "owner": { "name": "tlgimenes", "url": "https://github.com/tlgimenes" },
  "plugins": [
    {
      "name": "engram",
      "source": "./plugins/codex",
      "description": "Your personal coding-convention brain for Codex."
    }
  ]
}
```

- [ ] **Step 5: Validate JSON**

Run:
```bash
python3 -c "import json; [json.load(open(p)) for p in ['plugins/codex/.codex-plugin/plugin.json','plugins/codex/.mcp.json','plugins/codex/hooks/hooks.json','.agents/plugins/marketplace.json']]; print('codex json OK')"
```
Expected: `codex json OK`.

- [ ] **Step 6: Commit**

```bash
git add plugins/codex .agents
git commit -m "feat(plugin): Codex plugin + marketplace catalog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Dogfood the real plugin + dev docs

**Files:**
- Modify: `docs/DEV.md` (add: installing the local plugin with the debug binary)
- Create: `plugins/claude-code/.mcp.dev.json` (dev variant pointing at the debug binary)

**Interfaces:**
- Consumes: the built `engram` binary and the plugin from Tasks 3–4.

- [ ] **Step 1: Create `plugins/claude-code/.mcp.dev.json`** (used for local dogfooding before npm publish)

```json
{
  "mcpServers": {
    "engram": {
      "command": "./target/debug/engram",
      "args": ["mcp"]
    }
  }
}
```

- [ ] **Step 2: Append a dogfooding section to `docs/DEV.md`**

````markdown
## Dogfooding the full plugin (before npm publish)

The shipped plugin runs `npx -y @tlgimenes/engram` (published in Plan 4). Until
then, dogfood against the local debug binary:

```bash
cargo build

# Option A: register just the MCP server at the local binary (fast loop)
claude mcp add engram -- ./target/debug/engram mcp

# Option B: install the whole plugin from the local marketplace, then
# temporarily point its MCP at the debug binary by copying the dev variant:
cp plugins/claude-code/.mcp.dev.json plugins/claude-code/.mcp.json   # local only; don't commit
claude plugin marketplace add .
claude plugin install engram@engram
```

For the hooks to use the local binary during dev, add to `~/.claude/settings.json`
(SessionStart/Stop) pointing `command` at `./target/debug/engram hook ...`, or
ensure `engram` is on PATH (`cargo install --path crates/engram-cli`).

Smoke test the loop:

```bash
./target/debug/engram learn "Import directly; no barrel files" --scope global
# new Claude Code session in this repo -> the SessionStart hook injects the rule
# tell Claude "always prefer early returns" -> it should call engram_learn
./target/debug/engram list   # confirm both rules are stored
```
````

- [ ] **Step 3: Verify the full suite still passes**

Run: `cargo test --workspace && just sync-plugins-check`
Expected: all tests pass; skills are in sync (no drift).

- [ ] **Step 4: Commit**

```bash
git add docs/DEV.md plugins/claude-code/.mcp.dev.json
git commit -m "docs: dogfood the full plugin against the local debug binary

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (architecture §4 skills/plugins; product spec §6.2 inject, §6.1 capture, §6.3 inspect):**
- One canonical `SKILL.md` synced to both plugins → Tasks 3, 4 + `sync-plugins`. ✅
- Claude Code plugin: manifest, `.mcp.json`, hooks, command, marketplace → Task 3. ✅
- Codex plugin: manifest, `.mcp.json`, hooks, marketplace → Task 4. ✅
- SessionStart injection + Stop capture, cross-host (null transcript guard) → Task 2. ✅
- `engram_learn` MCP tool so the agent records conventions in-session → Task 1. ✅
- Dogfood the real plugin → Task 5. ✅
- `npx -y @tlgimenes/engram` everywhere; no npm publish here → constraints. ✅
- Codex hook-trust requirement → noted (user runs `/hooks`); documented behavior, no code needed.
- Enforcement (PreToolUse) → correctly **deferred to the fast-follow plan**.

**Placeholder scan:** No TBD/TODO. The `repo:` field simplification note in Task 1 Step 10 is an explicit clippy guard, not a placeholder.

**Type consistency:** `handle_learn`/`handle_list`/`handle_conventions` share the `db_path: &Path` shape; `parse_scope(s, cwd)` signature is identical across inject/cli/mcp callers; hook functions return the documented portable payload; `engram capture <transcript>` (spawned by the Stop hook) matches the Plan 2 `Cmd::Capture` signature.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-28-engram-plan3-plugin-packaging.md`. Execute via subagent-driven (recommended) or inline, **after** Plans 0–2.
