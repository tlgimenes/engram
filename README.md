# Repo Lens

Repo Lens is a local repo-intelligence layer for coding agents.

The premise is simple: frontier coding agents are useful, but they repeatedly
waste time rediscovering codebase structure, project conventions, test commands,
branch context, and developer preferences. Repo Lens runs locally, indexes that
context, and exposes it to agents through MCP and lightweight plugins.

It is not another chat app. It is a local co-processor for Claude Code, Codex,
Claude Desktop, Cursor, and other agentic coding tools.

## Thesis

Local models are not good enough to replace Sonnet/Opus-class coding agents for
hard repo work. They are useful for bounded local tasks:

- summarizing files and diffs
- classifying code areas
- preparing context packets
- extracting conventions from docs and examples
- ranking relevant files
- maintaining project and developer memory

The product should use local compute where it is reliable and cheap, then make
stronger agents better by giving them the right context before they start.

## Product Shape

Repo Lens runs as a local daemon with a repo index and an MCP server.

Core surfaces:

- MCP tools that coding agents can call
- Codex plugin packaging for setup, skills, and local tooling
- Claude Code / Claude Desktop integration via MCP
- optional web UI for inspecting the repo index, not chatting

The durable product is the repo-intelligence engine. Codex, Claude Code, Cursor,
and other agent integrations are adapters.

## MCP Tools

Possible tools:

- `repo.context_pack(task)` - produce a concise, task-specific context packet
- `repo.search(query)` - semantic and lexical search over the repo
- `repo.explain_file(path)` - summarize purpose, dependencies, and risks
- `repo.related_files(path)` - find callers, callees, tests, docs, and siblings
- `repo.diff_summary()` - summarize current git changes
- `repo.test_plan(diff)` - suggest verification commands for a change
- `repo.architecture_map(area)` - explain a subsystem boundary
- `repo.find_conventions(topic)` - find project-specific implementation patterns
- `repo.review_risks(diff)` - flag likely risks before agent review
- `memory.record_correction(event)` - learn from developer corrections

## Memory Layers

Repo Lens should separate memory by scope.

Global developer memory:

- preferred testing style
- commit and PR preferences
- tolerance for refactors
- naming and abstraction preferences
- recurring feedback given to agents

Project memory:

- architecture boundaries
- package ownership
- test and verification commands
- migration rules
- generated folders
- compatibility constraints
- project-specific conventions

Branch memory:

- current work-in-progress context
- relevant decisions made on this branch
- failed approaches
- task-specific notes
- agent run summaries

Memory should be inspectable and editable. The system should show what it
learned, where it learned it from, and what scope it applies to.

## Local Model Strategy

Local models are helpers, not the main coding brain.

Use local models for:

- summaries
- labels
- extraction
- query rewriting
- relevance explanations
- draft PR notes
- short context compression

Use deterministic tools for:

- git status, diff, log, and blame
- ripgrep search
- dependency graphs
- AST and import analysis
- test discovery
- package metadata
- compiler and linter output

Use frontier cloud agents for:

- complex implementation
- hard debugging
- large refactors
- ambiguous product/code synthesis
- long tool-use loops

## Initial Architecture

Potential implementation:

- Rust daemon for file watching, git integration, indexing, and process control
- SQLite for local state
- local embeddings for semantic search
- optional small local model for summaries and classification
- MCP server as the primary integration surface
- plugin adapters for Codex and Claude-compatible environments

The daemon should be fast, local-first, inspectable, and easy to disable.

## MVP

The smallest useful MVP:

1. Index a repo into SQLite.
2. Build lexical search plus optional local embeddings.
3. Summarize files and directories.
4. Watch git changes.
5. Expose MCP tools for `context_pack`, `search`, `diff_summary`, and
   `test_plan`.
6. Add a Codex plugin that tells Codex when to call those tools.
7. Add a minimal inspection UI or CLI.

First killer feature:

> Given a coding task, produce the best context packet for a coding agent.

Example output:

- likely files
- why each file matters
- relevant snippets
- conventions to follow
- known tests
- suggested commands
- risks

## Positioning

Repo Lens should not compete directly with Claude Code or Codex.

It should make those tools better.

Possible tagline:

> Local repo memory and context for coding agents.

Alternative framing:

> A local context engine that helps coding agents understand your repo before
> they edit it.

## Open Questions

- Should the first surface be an MCP server, a Codex plugin, or both?
- How much local model usage is worth the resource cost?
- Should memories be stored as plain markdown, SQLite rows, or both?
- Can branch memory be derived from git worktree state and agent run logs?
- What is the right privacy/export story for developer memory?
- Should Repo Lens support cloud-agent escalation directly, or only provide
  context to external agents?

