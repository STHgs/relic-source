# relic 地基方案（Foundation Phase Implementation Plan）

> **来源**：规划 agent session `ses_fc7aaa627ffebZO8G6sv4iIVln`（2026-08-25，规划 agent 产出，8 分 46 秒决策完备）。
> **状态**：决策完备，待用户拍板 F1（丢弃 hook 枚举）+ 给 go 信号即进入 W1 实施。
> **本阶段范围**：schema v2 权威化 + Platform adapter 抽象（opencode/omo/claude）+ ajv 校验 + 3 个前身 bug 在 relic 重写中修复 + TDD 测试套件 + AGENTS.md 交接更新。
> **明确不做**：persona 功能（仅留 schema 槽位）/ Codex/Cursor 适配器 / 模块·pack 系统 / 改现网 agent-governance / TS 工具链 / 迁移脚本。
> **语言**：方案原文为英文（规划 agent 精确产出，保留以免翻译失真）。中文导读见「relic/AGENTS.md」与主会话「工科通用语言版」解释。

---

## 0. Scope & Assumptions

**In scope (this phase)**: Schema v2 (authoritative) · platform-adapter interface + 3 adapters (opencode/omo/claude) ported from the `generate.mjs` monolith · `inject-rule` reimplementation with real ajv · 3 predecessor bugs fixed in the reimplementation · TDD test suite · `relic/AGENTS.md` handoff update.

**Explicitly OUT of scope (deferred)**: persona *feature* (only a schema SLOT) · Codex/Cursor adapters (only opencode/omo/claude) · module/pack *system* (only a schema SLOT) · TypeScript/build toolchain (ESM `.mjs` + JSDoc only) · touching `~/.config/opencode/agent-governance/` (live, 100% untouched) · live-config migration.

**Pre-decided defaults honored (not re-litigated)**: ESM `.mjs` + JSDoc; `relic/schema.json` at root + `relic/src/` + `relic/tests/`; greenfield reimplementation (no predecessor file copied then patched); `personas` minimal slot only; only 3 platforms; deps `ajv` + `yaml`; AGENTS.md handoff update is a mandatory final task.

**Grounding**: All predecessor-behavior claims verified by reading the live files — `generate.mjs`, `lib/inject-rule.mjs`, `schema.json`, `policies.yaml`, `relic/AGENTS.md`. Bug line numbers cited inline.

---

## 1. Schema v2 Design (the single contract)

`relic/schema.json` — JSON Schema draft-07, consumed by ajv as the **only** authority (kills predecessor bug #3). Concrete skeleton:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://relic.local/schemas/policies.v2.json",
  "title": "relic policies v2",
  "type": "object",
  "required": ["meta", "permissions"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["version", "description"],
      "properties": {
        "version": { "type": "integer", "const": 2 },
        "description": { "type": "string", "minLength": 1 },
        "evaluation": { "type": "string" }
      },
      "additionalProperties": false
    },
    "permissions": { "type": "array", "items": { "$ref": "#/definitions/permission" } },
    "workflows":   { "type": "array", "items": { "$ref": "#/definitions/workflow" }, "default": [] },
    "risk_levels": { "$ref": "#/definitions/riskLevels", "default": { "low": [], "medium": [], "high": [] } },
    "personas": {
      "type": "array",
      "description": "SLOT (persona feature deferred). Shape reserved for forward-compat; no generator consumes it yet.",
      "items": { "$ref": "#/definitions/personaSlot" },
      "default": []
    },
    "modules": {
      "type": "array",
      "description": "SLOT (module/pack system deferred). Shape reserved; no generator consumes it yet.",
      "items": { "$ref": "#/definitions/moduleSlot" },
      "default": []
    }
  },
  "additionalProperties": false,
  "definitions": {
    "permission": {
      "type": "object",
      "required": ["id", "intent", "applies_to", "enforcement", "tool", "action"],
      "properties": {
        "id":          { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
        "intent":      { "type": "string", "minLength": 5 },
        "applies_to":   { "type": "array", "items": { "enum": ["primary","deep","subagent","all"] }, "minItems": 1 },
        "enforcement": { "enum": ["runtime", "advisory"] },
        "tool":         { "enum": ["bash", "edit", "webfetch", "external_directory"] },
        "patterns": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "pattern": { "type": "string", "minLength": 1 },
              "action":  { "enum": ["ask", "deny", "allow"] }
            },
            "required": ["pattern"],
            "additionalProperties": false
          }
        },
        "action":        { "enum": ["ask", "deny", "allow"] },
        "alternatives":  { "type": "array", "items": { "type": "string" }, "default": [] }
      },
      "additionalProperties": false,
      "allOf": [
        {
          "if":   { "properties": { "tool": { "const": "bash" } }, "required": ["tool"] },
          "then": { "required": ["id","intent","applies_to","enforcement","tool","action","patterns"] }
        }
      ]
    },
    "workflow": {
      "type": "object",
      "required": ["id", "intent", "steps"],
      "properties": {
        "id":          { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
        "intent":      { "type": "string", "minLength": 5 },
        "applies_when":{ "type": "string" },
        "priority":    { "enum": ["critical", "high", "normal"], "default": "normal" },
        "steps":       { "type": "array", "items": { "type": "string" }, "minItems": 1 }
      },
      "additionalProperties": false
    },
    "riskLevels": {
      "type": "object",
      "properties": {
        "low":    { "type": "array", "items": { "type": "string" }, "default": [] },
        "medium": { "type": "array", "items": { "type": "string" }, "default": [] },
        "high":   { "type": "array", "items": { "type": "string" }, "default": [] }
      },
      "additionalProperties": false
    },
    "personaSlot": {
      "type": "object",
      "required": ["id", "name"],
      "properties": {
        "id":         { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
        "name":       { "type": "string", "minLength": 1 },
        "tone":       { "type": "string" },
        "directives": { "type": "array", "items": { "type": "string" }, "default": [] }
      },
      "additionalProperties": false
    },
    "moduleSlot": {
      "type": "object",
      "required": ["id", "name"],
      "properties": {
        "id":      { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
        "name":    { "type": "string", "minLength": 1 },
        "version": { "type": "string" },
        "enabled": { "type": "boolean", "default": true },
        "config":  { "type": "object", "additionalProperties": true }
      },
      "additionalProperties": false
    }
  }
}
```

**Key decisions baked into the schema**:
- `meta.version` is `const: 2` — strict. relic rejects `version: 1` (the live config's version). relic ships its own fixture; **live-config migration is a later-phase decision, explicitly NOT now**.
- `enforcement` enum is `["runtime", "advisory"]` — **`"hook"` dropped** (kills predecessor bug #2; reasoning in §2).
- `patterns[].pattern` is `required` + `minLength: 1`; items are always objects — ajv now rejects bare-string patterns (kills predecessor bug #1 at the schema layer).
- `bash` → `patterns` required via `if/then` (draft-07 conditional; ajv supports it) — replaces the hand-validator's `generate.mjs:76` check with authoritative schema. Preserves predecessor semantic: a bash rule must carry patterns. (Flagged as a low-stakes fork in §9 — default is "preserve predecessor behavior".)
- `additionalProperties: false` at top-level, on `meta`, on each permission/workflow/riskLevels/personaSlot/moduleSlot — closes the drift the hand-validator missed (predecessor `generate.mjs:67-98` never enforced `additionalProperties`).
- `useDefaults: true` fills: `workflows=[]`, `risk_levels={low:[],medium:[],high:[]}`, `personas=[]`, `modules=[]`, `priority="normal"`, `alternatives=[]` — generators can assume these are present, no null-guards needed.
- `personas` and `modules` are **slots only**: schema validates their shape, but no generator/orchestrator/adapter reads them this phase. Documented inline via the `description`. This satisfies "extensibility slots" without scope-creep into the feature.

**Version/migration note**: `meta.version` 1 → 2 is a hard break. relic is greenfield; no in-place migration. A future phase may add a `migrate` command (v1→v2 transforms: drop `hook` rules or map `hook`→`advisory`; already-object patterns pass through). Recorded as future work, NOT this phase.

---

## 2. Platform Adapter Interface (concrete signature)

`relic/src/adapters/base.mjs` defines the JSDoc contract; the 3 adapters implement it.

```js
// @ts-check
// relic/src/adapters/base.mjs

// @typedef {{ home: string, existsSync: (p: string) => boolean }} AdapterEnv
// @typedef {Record<string, string>} FileMap                       // filename → file content (pure data, no I/O)
//
// @typedef {Object} InstallReport
// @property {boolean} ok
// @property {string[]} written   // absolute paths written
// @property {string[]} backups   // backup paths created (.bak.<ts>)
// @property {string[]} skipped   // platforms not detected / files unchanged
// @property {string[]} errors    // human-readable error strings
//
// @typedef {Object} InstallOpts
// @property {string} home
// @property {boolean} dryRun     // true = report only, write nothing
//
// @typedef {Object} PlatformAdapter
// @property {string} id
// @property {(env: AdapterEnv) => boolean} detect
//     Pure w.r.t. filesystem reads; true iff this platform is present in env.
// @property {(policies: object, env: AdapterEnv) => FileMap} generate
//     PURE: policies → {filename: content}. No I/O, no env mutation, deterministic.
// @property {(fileMap: FileMap, opts: InstallOpts) => InstallReport} install
//     Applies FileMap (backup → write/merge/symlink). Idempotent. dryRun=true → report only.
```

**Three adapters map from `generate.mjs` as follows**:

| Adapter | `detect` | `generate` (from) | `install` (from `install.sh`) | role→agent handling |
|---|---|---|---|---|
| **omo** | `~/.omo/omo.jsonc` exists (`generate.mjs:102`) | `buildOmoPermission` (`generate.mjs:109-131`) → `{ agent: { permission: { tool: action \| { pattern: action } } } }` | deep-merge into `~/.omo/omo.jsonc` per-agent permission fields; backup `.bak.<ts>` | **role-preserving**: `primary→[sisyphus]`, `deep→[hephaestus]`, `subagent→[sisyphus-junior, atlas]`, `all→[all 4]` (`generate.mjs:38-53`) |
| **opencode** | `~/.config/opencode/opencode.jsonc` exists (`generate.mjs:103`) | `buildOpencodeAgent` (`generate.mjs:148-176`) → `{ general/build/explore: { mode, permission } }` + `AGENTS.md` (via shared renderer) | replace `agent` field in `opencode.jsonc`; symlink `AGENTS.md` → `~/.config/opencode/AGENTS.md`; backup | **role-flattening (documented decision)**: ALL runtime permissions applied to ALL native agents (`generate.mjs:159` comment: "原生没有 OMO 的角色区分"). Native OpenCode has no `applies_to` role concept, so flattening is the only faithful port. |
| **claude** | `~/.claude/` exists (`generate.mjs:104`) | `AGENTS.md` only (via shared renderer). **`claude.hooks.json` dropped** — see bug #2 below. | write `AGENTS.md` → `~/.claude/AGENTS.md`; backup | N/A (Claude has no agents/roles) |

**Shared helpers (factored out of the monolith)**:
- `src/core/permission-map.mjs` — `buildPermissionMap(rule)` → `{ [tool]: action } | { [tool]: { [pattern]: action } }`. Pattern-level `action` overrides rule-level `action` (`generate.mjs:121` `const act = item.action || p.action`). Used by **both** omo and opencode adapters → eliminates the duplicated logic at `generate.mjs:117-127` vs `164-173`.
- `src/render/agents-md.mjs` — `renderAgentsMd(policies)` → `string`. Pure port of `buildAgentsMd` (`generate.mjs:226-332`). Used by **both** opencode and claude adapters → no duplication.

**Native-OpenCode role-flattening decision (explicit)**: The predecessor chose to apply every `runtime` permission to every native agent (general/build/explore) because native OpenCode exposes no role axis. relic carries this forward unchanged. Consequence: on a native-OpenCode install, `applies_to: [primary]` and `applies_to: [all]` produce identical permission output. This is acceptable (over-inclusion is safe; runtime still asks/denies per pattern). A future phase could add a `platforms` filter on permissions to scope rules per-platform; **deferred**.

**Dead `claude.hooks.json` — RECOMMENDATION: DROP** (predecessor bug #2). Reasoning:
1. Zero `enforcement: hook` rules exist in the live `policies.yaml` (all 8 rules are `runtime`), so `buildClaudeHooks` (`generate.mjs:193-210`) always returns `null` and `generate.mjs:212-223` skips the file — it is generated zero times in practice.
2. `install.sh` never installs `claude.hooks.json` even when it is generated (install handles only `omo.jsonc`, `opencode.jsonc`, `AGENTS.md`, `skills/`). Double-dead.
3. Claude Code PreToolUse hooks only support `block` (no `ask`) — `generate.mjs:204` `action: p.action === 'deny' ? 'block' : 'block'` is a code smell confirming both branches collapse to `block`. A deny semantic is already expressible as `action: deny` + `enforcement: runtime`, mapped to the platform's deny mechanism. No information is lost by dropping the enum.
4. Keeping a dead enum is exactly the drift magnet the reimplementation is meant to eliminate.
→ Schema v2 drops `"hook"` from `enforcement` (only `runtime`/`advisory`). The claude adapter produces `AGENTS.md` only. If genuine hook *side-effects* (beyond block) are needed later, a `claude-hooks` adapter can be added without touching the schema. **This is the one fork that most wants explicit sign-off** (see §9).

---

## 3. File-by-File Build List

```
relic/
├── AGENTS.md                        # EXISTS — updated in final task (T11), not created
├── .gitignore                       # EXISTS — append node_modules/ and generated/ in T1
├── .gitattributes                   # EXISTS — untouched
├── package.json                     # T1 — type:module, deps ajv@8.20.0 + yaml@2.9.0, scripts test/generate
├── schema.json                      # T2 — v2 contract (§1 skeleton), THE authority
├── src/
│   ├── index.mjs                    # T10 — public API façade: load→validate→generate→install
│   ├── core/
│   │   ├── loader.mjs               # T4 — read+parse policies.yaml → object; throws on missing meta/permissions
│   │   ├── validator.mjs            # T3 — ajv instance compiled vs schema.json; useDefaults:true; validate(doc)→{ok,errors[]}
│   │   ├── permission-map.mjs       # T4 — buildPermissionMap(rule) shared helper (pattern action override)
│   │   ├── conflict.mjs             # T5 — port detect-conflict: idClash / pattern-overlap (glob→regex) / workflow Jaccard
│   │   └── inject.mjs               # T9 — port inject-rule: dry-run preview + apply(backup→write→validate→install→rollback); PATTERNS AS OBJECTS
│   ├── render/
│   │   └── agents-md.mjs            # T6 — renderAgentsMd(policies)→string (pure port of buildAgentsMd)
│   ├── adapters/
│   │   ├── base.mjs                 # T7 — PlatformAdapter JSDoc typedef + backup/writeWithHeader helpers
│   │   ├── opencode.mjs             # T8 — id=opencode; detect; generate (flattened agents + AGENTS.md); install (replace agent field + symlink)
│   │   ├── omo.mjs                  # T8 — id=omo; detect; generate (role-mapped per-agent); install (deep-merge omo.jsonc)
│   │   └── claude.mjs               # T8 — id=claude; detect; generate (AGENTS.md only); install (write ~/.claude/AGENTS.md)
│   └── orchestrator/
│       └── generate.mjs             # T10 — detect all adapters → generate FileMaps → install (or dryRun); replaces the monolith
└── tests/
    ├── fixtures/
    │   ├── policies-good.yaml              # T2 — known-valid v2 subset (redacted from live policies)
    │   ├── policies-bad-patterns-strings.yaml  # T2 — patterns as bare strings (proves bug #1 rejection)
    │   └── policies-bad-hook.yaml          # T2 — enforcement: hook present (proves bug #2 rejection)
    ├── validator.test.mjs            # T3 — accepts good / rejects patterns-strings / rejects hook / applies defaults / rejects unknown field
    ├── helpers.test.mjs              # T4 — loader parses/throws; permission-map pattern-override + no-patterns single-value
    ├── conflict.test.mjs             # T5 — idClash hard-block / pattern overlap detected / workflow Jaccard warning
    ├── agents-md.test.mjs            # T6 — renderAgentsMd output contains expected sections (hard constraints table, risk levels, workflows)
    ├── inject.test.mjs               # T9 — dry-run preview correct / PATTERNS EMITTED AS OBJECTS / apply+rollback on validation failure
    ├── adapters.test.mjs             # T8 — FileMap keys per adapter / omo resolveAgents mapping / opencode role-flattening / round-trip stable
    └── orchestrator.test.mjs         # T10 — detect→generate→install(dryRun) report shape; only-detected adapters run
```

**15 source files to create** + `package.json` + `schema.json` + 3 fixtures + 7 test files. `relic/AGENTS.md` updated, not created. Fixtures live under `tests/fixtures/` (NOT at relic root — avoids confusion with a real config).

---

## 4. Bug-Fix Mapping (predecessor → relic)

| # | Predecessor bug (ground-truth citation) | Root cause | relic fix (file + mechanism) | Test that proves it |
|---|---|---|---|---|
| 1 | `/permission` skill breaks bash rules: `inject-rule.mjs:99-102` emits `patterns:` then `      - "sudo *"` (bare strings), but `schema.json:33-44` requires `[{pattern, action?}]` objects and `generate.mjs:78` reads `item.pattern` → undefined → validator fails → apply rolls back silently at `inject-rule.mjs:177-188`. Also: `inject-rule.mjs:99` only emits patterns for `tool==='bash'`, so non-bash patterned rules (e.g. `external-dir-policy` with `/tmp/*→allow`) lose patterns entirely on inject. | Three-way inconsistency: skill passes `string[]` / generator writes `string` / schema wants `object`. | `src/core/inject.mjs` emits patterns as objects for **all** tools (drop the `tool==='bash'` gate): `patterns:\n  - pattern: "sudo *"\n`. Schema v2 `patterns.items` is an object with `required:["pattern"]` → ajv rejects bare strings at the schema layer too. End-to-end objects. | `tests/inject.test.mjs`: dry-run YAML snippet re-parses to `[{pattern:"sudo *"}]` (not `["sudo *"]`). `tests/validator.test.mjs`: `policies-bad-patterns-strings.yaml` rejected. |
| 2 | `claude.hooks.json` dead: `generate.mjs:193-210` filters `enforcement==='hook'`, no such rules exist in `policies.yaml`; `generate.mjs:204` collapses `deny/block` to always `block`; `install.sh` never installs the file even when generated. | Hook enum exists but is unused and only supports block (no ask). | **DROP**: schema v2 `enforcement` enum = `["runtime","advisory"]`; no `buildClaudeHooks` in relic; claude adapter produces `AGENTS.md` only. (Recommended — see §2 reasoning, §9 fork.) | `tests/validator.test.mjs`: `policies-bad-hook.yaml` rejected. |
| 3 | `schema.json` decorative: `generate.mjs:67-98` is a hand-validator parallel to the schema; ajv never imported. Drift: hand-validator doesn't enforce `additionalProperties:false` (schema:16,42,52,75,86) nor the bash→patterns conditional. | Two sources of truth. | `src/core/validator.mjs` compiles `schema.json` with ajv (`useDefaults:true`, `allErrors:true`); the hand-validator is gone. `additionalProperties:false` enforced by ajv. Bash→patterns required enforced by schema `if/then` (ajv draft-07 native). Schema is the single contract. | `tests/validator.test.mjs`: unknown top-level field rejected (hand-validator missed this); bash rule with no patterns rejected (was only hand-checked before). |

---

## 5. Dependency + Tooling

`relic/package.json` (exact contents):

```json
{
  "name": "relic",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Portable personal agent-configuration system (rules/workflows/persona).",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --test tests/",
    "generate": "node src/orchestrator/generate.mjs"
  },
  "dependencies": {
    "ajv": "8.20.0",
    "yaml": "2.9.0"
  }
}
```

**Versions confirmed by librarian research**:
- `ajv@8.20.0` — default export `import Ajv from 'ajv'`; draft-07 meta-schema auto-loaded (no `ajv-formats`/draft-07 add-on needed for our enums/patterns/const/if-then); `useDefaults`/`allErrors` work as needed; `validate.errors` + `ajv.errorsText()` for human messages.
- `yaml@2.9.0` — `import { parse, stringify } from 'yaml'`; zero-dep; YAML 1.2 core schema; `parse` throws on invalid input.
- **node:test** — built-in, zero dependency; `import { describe, it } from 'node:test'` + `import assert from 'node:assert/strict'`; run via `node --test tests/`. Requires **Node ≥20** (hence `engines.node`).
- `.mjs` files run natively via `node path/to/file.mjs` (no flags); top-level `await` allowed in ESM (stable since Node 14.8).

**`.gitignore` additions (T1)**: `node_modules/`, `generated/` (orchestrator output, never committed), `*.bak.*`.

**Test runner choice**: `node:test` (built-in) — confirmed zero-dependency, sufficient for a small library. No `mocha`/`vitest`/`uvu`. **Approved.**

**LSP** (T1, for diagnostics during build): configure `typescript-language-server` (or Biome) for `.mjs`/JSDoc via `/lsp-setup` so `lsp_diagnostics`/go-to-definition work for tasks T2–T10.

---

## 6. Task Dependency Graph

```
T1 (tooling) ─┬─→ T3 (validator)        ──┐
              ├─→ T4 (loader+perm-map) ──┐ │
              └─→ T7 (adapter base) ──┐  │ │
T2 (schema+fixtures) ─┬─→ T3 ──────────┼──┘ │
                       ├─→ T4 ─────────┤    │
                       ├─→ T5 (conflict)    │
                       ├─→ T6 (agents-md) ─┤
                       │                   ├─→ T8 (3 adapters) ─┐
                       │                   │                     ├─→ T10 (orchestrator+index) ─→ T11 (AGENTS.md+commit)
                       │            T3 ──→ T9 (inject) ──────────┘
                       │            T5 ──→ T9
                       └────────────────────────────────────────→ T11 (final)
```

Critical path: **T1 → T2 → T3 → T9 → T10 → T11** (validator gates inject; inject gates orchestrator; orchestrator gates the handoff commit). T4/T5/T6/T7/T8 are fan-out parallel work feeding T8/T9/T10.

---

## 7. Parallel Execution Waves

| Wave | Tasks (run in parallel) | Unblock |
|---|---|---|
| **W1** | T1 tooling · T2 schema+fixtures | W2 |
| **W2** | T3 validator · T4 loader+perm-map · T5 conflict · T6 agents-md renderer · T7 adapter base | W3 |
| **W3** | T8 three adapters (+adapters.test) · T9 inject (+inject.test) | W4 |
| **W4** | T10 orchestrator + `src/index.mjs` (+orchestrator.test) | W5 |
| **W5** | T11 `relic/AGENTS.md` handoff update + final commit | — |

Max parallelism = 5 (W2). W3 runs 2 in parallel. Waves are strictly ordered by the dependency graph.

---

## 8. Task Specifications (delegation-ready)

Each task: one atomic deliverable, TDD (test committed alongside code), ends with one atomic commit (git-master discipline).

| Task | Category | Skills | Deliverable + acceptance | Deps | Commit message |
|---|---|---|---|---|---|
| **T1** tooling | `quick` | `programming`, `lsp-setup` | `package.json` (§5) + `.gitignore` append. QA: `npm install` succeeds; `node --test tests/` runs (0 tests, exits 0). | — | `chore: scaffold tooling (package.json, .gitignore)` |
| **T2** schema+fixtures | `unspecified-high` | `programming` | `schema.json` (§1 skeleton) + 3 fixtures (`policies-good.yaml`, `policies-bad-patterns-strings.yaml`, `policies-bad-hook.yaml`). QA: schema parses; fixtures hand-check valid/invalid as labeled. | — | `feat(schema): v2 contract with persona/module slots, drop hook enum` |
| **T3** validator | `unspecified-high` | `programming` | `src/core/validator.mjs` (ajv vs schema.json, `useDefaults:true`, `allErrors:true`, `validate(doc)→{ok:boolean, errors:string[]}`) + `tests/validator.test.mjs`. QA: §10 assertions V1–V5. | T1,T2 | `feat(validator): ajv-authoritative validation with defaults` |
| **T4** loader+perm-map | `quick` | `programming` | `src/core/loader.mjs` (read+parse YAML→object; throws on missing `meta`/`permissions`) + `src/core/permission-map.mjs` (`buildPermissionMap(rule)`, pattern-action override) + `tests/helpers.test.mjs`. | T1,T2 | `feat(core): loader + permission-map helpers` |
| **T5** conflict | `unspecified-high` | `programming` | `src/core/conflict.mjs` (port `detect-conflict.mjs`'s 3 layers: idClash hard-block / pattern-overlap glob→regex / workflow Jaccard) + `tests/conflict.test.mjs`. | T2 | `feat(core): 3-layer conflict detection (ported)` |
| **T6** agents-md renderer | `unspecified-high` | `programming` | `src/render/agents-md.mjs` (`renderAgentsMd(policies)→string`, pure port of `buildAgentsMd` `generate.mjs:226-332`) + `tests/agents-md.test.mjs`. | T2 | `feat(render): AGENTS.md renderer (ported)` |
| **T7** adapter base | `quick` | `programming` | `src/adapters/base.mjs` (JSDoc typedefs from §2 + `backup(path)` + `writeWithHeader(path, content)` helpers). | T1 | `feat(adapters): platform adapter base contract` |
| **T8** three adapters | `unspecified-high` | `programming` | `src/adapters/{opencode,omo,claude}.mjs` (per §2 mapping) + `tests/adapters.test.mjs`. QA: §10 assertions A1–A5. | T4,T6,T7 | `feat(adapters): opencode/omo/claude adapters (monolith refactor)` |
| **T9** inject (bug #1 fix) | `unspecified-high` | `programming`, `git-master` | `src/core/inject.mjs` (port `inject-rule.mjs`; **patterns emitted as objects for all tools**; dry-run preview; apply = backup→write→validate(ajv)→install(orchestrator)→rollback-on-failure; exit codes 0/1/2/3/4 preserved) + `tests/inject.test.mjs`. QA: §10 assertions I1–I3. | T3,T5 | `fix(inject): patterns as objects end-to-end + ajv rollback` |
| **T10** orchestrator+API | `unspecified-high` | `programming` | `src/orchestrator/generate.mjs` (detect all adapters → generate FileMaps → install or `dryRun`) + `src/index.mjs` (public façade: `load→validate→generate→install`) + `tests/orchestrator.test.mjs`. QA: §10 O1–O3. | T8,T9 | `feat(orchestrator): detect→generate→install pipeline + public API` |
| **T11** AGENTS.md handoff | `writing` | `git-master` | Update `relic/AGENTS.md` 「当前进度」(checklist to done) + 「交接说明」(上轮做了/下轮该做/待澄清) per `project-scaffold` governance (≤200 lines, facts only). Then final atomic commit. | ALL | `docs: update relic/AGENTS.md handoff (foundation complete)` |

---

## 9. Forks Needing User Input (before build)

| Fork | Recommendation | Default if user says nothing | Stakes |
|---|---|---|---|
| **F1 (PRIMARY): hook enum — DROP vs IMPLEMENT properly** | **DROP** (reasoning in §2: dead in practice, only supports block, deny already expressible via `runtime`+`deny`, drift magnet). | Proceed with DROP. | **HIGH — want explicit sign-off**. |
| **F2 (MINOR): bash-requires-patterns** | Keep predecessor semantic (bash rule must carry patterns, via schema `if/then`). A blanket "deny all bash" with no patterns is currently invalid. | Keep. | Low (preserves behavior; easy to relax later by dropping the `if/then`). |
| **F3 (MINOR): Claude global install path** | Write `AGENTS.md` to `~/.claude/AGENTS.md` (relic canonical name). Alternative: `~/.claude/CLAUDE.md` (Claude Code's traditional global name) or no global install (project-local only). | `~/.claude/AGENTS.md`. | Low (path constant, trivial to change). |

**Already resolved (not forks, noted for transparency)**: persona slot shape `{id,name,tone,directives[]}` (task-given example) · native-OpenCode role-flattening (carry forward from predecessor) · strict `meta.version=2` (greenfield, migration deferred) · ESM+JSDoc (pre-decided) · node:test (zero-dep confirmed) · adapter owns role→agent map (not a schema section).

---

## 10. Success Criteria / QA Assertions (TDD, defined before build)

A task is "done" when its assertions pass via `node --test`.

**Validator (T3)**:
- V1: `policies-good.yaml` validates `ok:true`; defaults applied (`workflows[].priority==='normal'`, `alternatives===[]`, `risk_levels` fully populated).
- V2: `policies-bad-patterns-strings.yaml` rejected — error mentions `patterns`/must be object. (bug #1 schema layer)
- V3: `policies-bad-hook.yaml` rejected — error mentions `enforcement` enum. (bug #2)
- V4: bash permission with missing/empty `patterns` rejected (schema `if/then`). (bug #3 — was only hand-checked)
- V5: unknown top-level field (e.g. `unknown_section:`) rejected — `additionalProperties:false` enforced by ajv. (bug #3 drift fix — hand-validator never caught this)

**Helpers (T4)**:
- H1: `loader` parses `policies-good.yaml` to an object with `meta`/`permissions`; throws on a doc missing `meta` or `permissions`.
- H2: `buildPermissionMap` — pattern-level `action` overrides rule-level `action` (e.g. `external-dir-policy`: rule action `ask`, pattern `/tmp/*` action `allow` → map has `/tmp/*:allow`); no-patterns rule yields single-value `{ tool: action }`.

**Conflict (T5)**:
- C1: `idClash` (duplicate id) → hard-block (the caller exits 2 / reports `blocked:'id_conflict'`).
- C2: two bash rules with overlapping glob patterns (e.g. `rm * /mnt/c/*` vs `rm * /mnt/c/Users/*`) → `duplicates`/`conflicts` non-empty.
- C3: two workflows with high step Jaccard similarity (≥0.6) → `warnings` non-empty (non-blocking).

**AGENTS.md renderer (T6)**:
- R1: output contains `## 硬约束` table with one row per `runtime` permission (tool / pattern / action / intent).
- R2: output contains `## 风险分级` with low/medium/high subsections when `risk_levels` populated.
- R3: output contains `## 标准流程` with numbered steps per workflow.

**Inject (T9)**:
- I1: dry-run preview's `yamlSnippet` re-parses (via `yaml.parse`) to an object whose `patterns` is `[{pattern:"..."}]` (objects), **never** `["..."]` (strings). (bug #1 inject layer — the definitive proof)
- I2: apply with a rule that fails ajv validation → rollback fires, `policies.yaml` restored byte-for-byte, report `rolledBack:true`.
- I3: exit codes preserved (0 success / 1 arg error / 2 id-clash / 3 validation-failed-rolled-back / 4 install-failed).

**Adapters (T8)**:
- A1: opencode `generate(policies)` FileMap keys = `{ 'opencode.agent.jsonc', 'AGENTS.md' }`.
- A2: omo FileMap keys = `{ 'omo.permission.jsonc' }`; `resolveAgents(['primary','deep'])` = `['sisyphus','hephaestus']`; `resolveAgents(['all'])` = all 4.
- A3: opencode role-flattening — ALL `runtime` permissions appear under `general` AND `build` AND `explore` (identical permission maps).
- A4: claude FileMap keys = `{ 'AGENTS.md' }` only — **no `claude.hooks.json`** (bug #2 drop verified at output layer).
- A5: round-trip — `generate(p)` → `generate(parse(stringify(generate(p))))` produces byte-identical FileMap (deterministic, stable).

**Orchestrator (T10)**:
- O1: with all 3 platforms faked-present (temp `HOME`), `install({dryRun:true})` report has `written:[]`, `skipped:[]`, no `errors`.
- O2: with no platform present, `skipped` lists all 3 adapters, `written:[]`.
- O3: `src/index.mjs` `load(path)→validate→generate→install(dryRun)` pipeline returns a coherent `InstallReport`.

**Full suite**: `node --test tests/` exits 0 after W4.

---

## 11. Atomic Commit Strategy (git-master discipline)

11 atomic commits, one per task, conventional-commits style (matches the repo's existing tone). Each commit:
- staged with **only** that task's files (never `git add -A`),
- message body (when useful) states the WHY and cites the predecessor line numbers being fixed,
- never amend/force-push; if a task's commit fails a hook, fix and create a fresh commit.

Sequence (≡ the 11 tasks above):
1. `chore: scaffold tooling (package.json, .gitignore)` — T1
2. `feat(schema): v2 contract with persona/module slots, drop hook enum` — T2
3. `feat(validator): ajv-authoritative validation with defaults` — T3
4. `feat(core): loader + permission-map helpers` — T4
5. `feat(core): 3-layer conflict detection (ported)` — T5
6. `feat(render): AGENTS.md renderer (ported)` — T6
7. `feat(adapters): platform adapter base contract` — T7
8. `feat(adapters): opencode/omo/claude adapters (monolith refactor)` — T8
9. `fix(inject): patterns as objects end-to-end + ajv rollback` — T9 (this is the bug-#1 fix commit; body cites `inject-rule.mjs:99-102` + `generate.mjs:78`)
10. `feat(orchestrator): detect→generate→install pipeline + public API` — T10
11. `docs: update relic/AGENTS.md handoff (foundation complete)` — T11

`git-master` skill loaded on T9 and T11 (the bug-fix and the final doc/history-commit, where hygiene matters most); T1 loads `lsp-setup`; all code tasks load `programming`. Between tasks, the repo stays green (`node --test` passes after each commit — TDD guarantees this).

---

## 12. Post-Foundation (explicitly deferred, NOT this phase)

persona generation · Codex/Cursor adapters · module/pack system · live-config migration (v1→v2, replace/symlink/coexist decision) · a `relic` CLI binary · `remove-ai-slops` cleanup pass · `/review-work` post-implementation review. Recorded in `relic/AGENTS.md` 「待澄清」 block by T11.

---

## TODO List for the Executing Agent (build phase, after approval)

- [ ] **W1·T1** `relic/package.json` + `.gitignore` — type:module, ajv@8.20.0, yaml@2.9.0, scripts test/generate, engines node≥20; append node_modules/ generated/ *.bak.* to .gitignore. Then `npm install`. Commit `chore: scaffold tooling`.
- [ ] **W1·T2** `relic/schema.json` (§1 skeleton) + `tests/fixtures/{policies-good,policies-bad-patterns-strings,policies-bad-hook}.yaml`. Commit `feat(schema): v2 contract…`.
- [ ] **W2·T3** `src/core/validator.mjs` (ajv, useDefaults, allErrors) + `tests/validator.test.mjs` asserting V1–V5. Commit `feat(validator)…`.
- [ ] **W2·T4** `src/core/loader.mjs` + `src/core/permission-map.mjs` + `tests/helpers.test.mjs` (H1–H2). Commit `feat(core): loader + permission-map…`.
- [ ] **W2·T5** `src/core/conflict.mjs` (3-layer port) + `tests/conflict.test.mjs` (C1–C3). Commit `feat(core): conflict…`.
- [ ] **W2·T6** `src/render/agents-md.mjs` + `tests/agents-md.test.mjs` (R1–R3). Commit `feat(render)…`.
- [ ] **W2·T7** `src/adapters/base.mjs` (§2 typedefs + helpers). Commit `feat(adapters): base…`.
- [ ] **W3·T8** `src/adapters/{opencode,omo,claude}.mjs` + `tests/adapters.test.mjs` (A1–A5). Commit `feat(adapters): opencode/omo/claude…`.
- [ ] **W3·T9** `src/core/inject.mjs` (patterns-as-objects fix) + `tests/inject.test.mjs` (I1–I3). Commit `fix(inject): patterns as objects…`.
- [ ] **W4·T10** `src/orchestrator/generate.mjs` + `src/index.mjs` + `tests/orchestrator.test.mjs` (O1–O3). Commit `feat(orchestrator)…`.
- [ ] **W5·T11** Update `relic/AGENTS.md` 当前进度 + 交接说明 (≤200 lines); final commit `docs: update relic/AGENTS.md handoff…`.
