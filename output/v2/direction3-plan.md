# relic Direction 3 — Modular + Profile On-Demand Loading (Implementation Plan)

> **来源**：规划 agent session `ses_fc36fbf9bffethTs3rxvREGGfB`（2026-08-26，规划 agent 产出，29 分 23 秒）。
> **状态**：决策完备，F1-F6 全部按用户倾向定，唯一待拍板 F-MIGRATE（见 §15）。等 go 信号即进 W1。
> **本阶段范围**：模块化存储 + profile 配置档 + loader/merger + 跨模块冲突检测 + CLI --profile/--module + round-trip 证明。
> **明确不做**：persona 功能 / Codex/Cursor 适配器 / 模块间依赖解析 / 运行时 profile 切换 / 模块市场 / 现网 agent-governance 100% 不动。
> **前置**：地基阶段 + 方案 A（CLI 入口）已完成，107 tests 0 fail。本阶段在其上加层，不动适配器/orchestrator 核心。

---

## 0. Scope & Grounding

**Problem (verified)**: `loader.mjs:35` `loadPolicies(absPath)` reads ONE `policies.yaml` → one object; `generate.mjs` CLI loads it, `renderAgentsMd` renders ALL of it into one AGENTS.md read every session. Token cost grows linearly with rule count. The "标准流程" (workflows) section is the heaviest consumer (~59%). No subset-loading exists today.

**What exists and is reused (verified)**:
- `schema.json` reserves `modules` slot = `moduleSlot {id,name,version,enabled,config}` (lines 27-32, 100-111) and `personas` slot. Direction 3 **consumes the `modules` slot as a registry** and adds `profiles` additively.
- `conflict.mjs` 3-layer detection (`detectPermissionConflict`/`detectWorkflowConflict`, lines 52/139) operates on arrays — reusable for cross-module all-pairs via a new wrapper.
- `validator.mjs` `createValidator()` compiles schema.json with ajv `useDefaults:true` — extended with one `createModuleValidator()` for fragments.
- `generate.mjs` orchestrator `generate(policies, opts)` takes an already-loaded policies object — **unchanged**; only its CLI load-step changes.
- Adapters call `renderAgentsMd(policies)` — threading the profile name via `meta.profile` (not an adapter signature change) keeps them untouched.
- Tests: 107 pass, `node --test tests/*.test.mjs`. Per-module `.test.mjs`, `fakeEnv`/`runCli`/scratch-dir conventions.

**Pre-decided defaults honored**: ESM `.mjs`+JSDoc · deps `ajv`+`yaml` only · greenfield-on-foundation · persona/Codex/Cursor deferred · live config 100% untouched · AGENTS.md handoff mandatory final task · F1(hook-drop)/F2(bash-patterns) settled.

---

## 1. Module Format Design (concrete)

**Decision (F1 = directory-per-module, resolved)**: each module is a directory under `modules/` containing a `module.yaml` rule fragment. Directory layout reserves space for future `README.md` / `persona.yaml` (F1 rationale).

**Location**: `<repo>/modules/<module-id>/module.yaml` (repo-root `modules/`, configurable via `modulesDir` option).

**Module file skeleton** (`modules/sudo-safety/module.yaml`):
```yaml
# modules/sudo-safety/module.yaml — a rule fragment (NOT a full policies doc; no meta)
id: sudo-safety            # REQUIRED, must match directory name AND registry id (triple cross-check)
permissions:
  - id: sudo-ask
    intent: Require confirmation before privilege escalation
    applies_to: [primary, deep]
    enforcement: runtime
    tool: bash
    patterns:
      - { pattern: "sudo *", action: ask }
      - { pattern: "su *",   action: ask }
      - { pattern: "doas *", action: ask }
    action: ask
    alternatives:
      - Run without sudo when no privilege needed
workflows: []               # optional; defaults to [] via schema
risk_levels:                # optional; defaults to empty buckets via schema
  high:
    - sudo/su privilege escalation
```

**Fragment rules** (validated by new `moduleFragment` definition, §3):
- `id` is the only required field; `permissions`/`workflows`/`risk_levels` all optional (default `[]`/`{low:[],medium:[],high:[]}` via `useDefaults`).
- A fragment is a pure rule bundle — NO `meta` (the manifest supplies `meta`).
- Fragment `id` must equal its directory name AND the manifest registry entry `id` (loader asserts all three; mismatch → hard error).

---

## 2. Profile Format Design (concrete)

**Decision (F2 = profiles in schema top-level `profiles` section; F3 = `default:true` flag; F5 = whole-module groups only — all resolved)**: profiles live in `policies.yaml` as an additive `profiles:` array. Single-source, schema-validated.

**Profile skeleton** (inside `policies.yaml`):
```yaml
profiles:
  - id: work
    name: Work profile
    modules: [sudo-safety, disk-protect, web-safety]   # registry ids; order = merge/render order
    default: true                                        # at most one; used when --profile omitted
  - id: personal
    name: Personal profile
    modules: [pdf-handling, download-cleanup]
  - id: full
    name: Full profile
    modules: all                                         # special: all enabled registry modules
```

**Profile fields** (new `profile` definition, §3):
- `id` (required, `^[a-z][a-z0-9-]*$`), `name` (required), `modules` (required: array of registry-ids **or** the literal `"all"`), `default` (optional bool, default `false`).

**Selection semantics**:
- `--profile <id>` → resolve by id; unknown id → `ok:false`, clear error.
- No `--profile` → use the entry with `default:true`; if none → `ok:false` ("mark a profile default:true or pass --profile").
- `modules: all` → load every registry entry with `enabled:true` (registry `enabled` defaults `true`; `enabled:false` is a kill-switch honored by the loader even if a profile references it — skip + warn).

---

## 3. Schema v2 Additive Changes (the diff)

**Decision (F-VERSION = stay v2, additive, resolved)**: changes are purely additive. Existing v2 docs (all fixtures, relic/policies.yaml) validate unchanged → 107 tests stay green. `meta.version const:2` stays.

Add to `schema.json` `properties`:
```json
"profiles": {
  "type": "array",
  "description": "Profiles select a subset of registry modules to load per session (direction 3).",
  "items": { "$ref": "#/definitions/profile" },
  "default": []
}
```
Add `profile` to `meta.properties` (so the merged doc can carry the active profile without breaking `meta.additionalProperties:false`):
```json
"profile": {
  "type": "object",
  "properties": {
    "id":   { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "name": { "type": "string", "minLength": 1 }
  },
  "additionalProperties": false
}
```
New `definitions` (reusing existing `permission`/`workflow`/`riskLevels`):
```json
"profile": {
  "type": "object",
  "required": ["id", "name", "modules"],
  "properties": {
    "id":      { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "name":    { "type": "string", "minLength": 1 },
    "modules": {
      "oneOf": [
        { "type": "array", "items": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" } },
        { "const": "all" }
      ]
    },
    "default": { "type": "boolean", "default": false }
  },
  "additionalProperties": false
},
"moduleFragment": {
  "type": "object",
  "required": ["id"],
  "properties": {
    "id":          { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "permissions": { "type": "array", "items": { "$ref": "#/definitions/permission" }, "default": [] },
    "workflows":   { "type": "array", "items": { "$ref": "#/definitions/workflow" },   "default": [] },
    "risk_levels": { "$ref": "#/definitions/riskLevels", "default": { "low": [], "medium": [], "high": [] } }
  },
  "additionalProperties": false
}
```
**`moduleSlot` (registry entry) UNCHANGED** — already `{id,name,version,enabled,config}`; now consumed as the module registry. `personas` slot unchanged (still deferred).

**Net schema churn**: +1 top-level property (`profiles`), +1 meta property (`profile`), +2 definitions (`profile`, `moduleFragment`). No version bump.

---

## 4. Loader + Merger Design (signatures + call chain)

**New file** `src/core/module-loader.mjs`. Pure data + injected I/O (testable, matches loader.mjs style).

```js
// src/core/module-loader.mjs
// loadProfile: manifest + modules/ → merged policies object (profile-selected subset)

/**
 * Load a profile: read manifest → validate(full) → resolve profile →
 * resolve modules from registry → load+validate each fragment →
 * mergeFragments → validate(merged, full) → detectCrossModuleConflicts.
 * @param {object} opts
 * @param {string} opts.manifestPath      policies.yaml (manifest) absolute path
 * @param {string} [opts.modulesDir]      modules/ dir; default <manifestDir>/modules
 * @param {string} [opts.profileName]     profile id; omit → use default:true
 * @param {(p:string)=>string} [opts.read]   readFileSync inject (tests)
 * @param {(p:string)=>boolean} [opts.exists] existsSync inject (tests)
 * @param {(doc:object)=>{ok:boolean,errors:string[],doc:object}} [opts.validate] full-v2 validator inject
 * @param {(frag:object)=>{ok:boolean,errors:string[],doc:object}} [opts.validateModule] moduleFragment validator inject
 * @returns {{ok:boolean, policies?:object, profile?:object, conflicts?:object, errors?:string[]}}
 *   policies: merged v2 doc with meta.profile={id,name} set; ready for generate()/renderAgentsMd()
 */
export function loadProfile(opts) { /* ... */ }

/**
 * Pure merge of fragments into one policies doc (no I/O; reused by loadProfile + tests).
 * @param {object} manifest   validated manifest (meta, profiles, modules registry, optional inline rules)
 * @param {{id:string,doc:object}[]} fragments  loaded+validated module fragments (already in profile order)
 * @returns {object} merged policies doc (meta from manifest + meta.profile; modules/profiles stripped to [])
 */
export function mergeFragments(manifest, fragments, profile) { /* ... */ }
```

**Merge semantics** (deterministic, order-stable for round-trip):
- `permissions` = `manifest.permissions` (inline, always-on) ++ concat each fragment's `permissions` **in profile.modules order**.
- `workflows` = `manifest.workflows` ++ concat fragments' `workflows` (same order).
- `risk_levels` = per-level concat (low/medium/high) across manifest + all fragments, **dedup per level preserving first-seen order** (avoids duplicate bullets in AGENTS.md).
- `meta` = manifest.meta + `meta.profile = {id, name}` (the active profile).
- `personas` = manifest.personas (pass-through). `modules`/`profiles` = `[]` in merged doc (manifest metadata stripped; not rendered).

**Cross-module conflict (Decision F6 = load-time full check, resolved)** — extend `conflict.mjs`:
```js
/**
 * All-pairs conflict sweep across merged permissions + workflows (reuses layer-1/2/3 primitives).
 * @param {object[]} permissions  merged
 * @param {object[]} workflows    merged
 * @returns {{ok:boolean, idClashes:object[], permissionConflicts:object[], workflowConflicts:object[], warnings:string[]}}
 *   ok=false iff any idClash (duplicate id across modules = hard error, cannot render).
 *   permissionConflicts/workflowConflicts = non-blocking duplicates/overlap (surfaced as warnings).
 */
export function detectCrossModuleConflicts(permissions, workflows) { /* iterates pairs via existing detect* */ }
```
Reuses `patternsOverlap`/`jaccardSimilarity` internally. loadProfile runs this **after** merge (F6); `idClashes` non-empty → `loadProfile` returns `ok:false`.

**Call chain** (the whole pipeline):
```
generate --profile work
  └─ CLI (generate.mjs) reads --profile; load step branches:
       if manifest has profiles[]  → loadProfile({manifestPath, modulesDir, profileName:'work'})
       else (no profiles section) → loadPolicies(manifestPath)            # single-file mode, current behavior
  └─ loadProfile:
       read manifest → validate(full v2) → resolve profile('work')
       → resolve modules from registry (enabled check) → for each: read modules/<id>/module.yaml
       → validateModule(fragment) → mergeFragments(manifest, fragments, profile)
       → set merged.meta.profile → validate(merged, full v2) → detectCrossModuleConflicts(merged)
  └─ mergedPolicies (a normal v2 doc) → generate(mergedPolicies, {dryRun})   # orchestrator UNCHANGED
       → adapter.generate(mergedPolicies, env)                                 # adapters UNCHANGED
           → renderAgentsMd(mergedPolicies)   # reads merged.meta.profile → header line (§5)
```

**`validator.mjs` addition**: `createModuleValidator(schemaPath?)` compiles a self-contained schema `{type:object, ...moduleFragment}` (or the fragment `$ref`) for standalone fragment validation.

**`index.mjs` addition**: `pipeline({policiesPath, dryRun, home, profile})` — if `profile` passed or manifest has `profiles`+default → `loadProfile`; else `loadPolicies`. Minimal routing change.

---

## 5. Renderer Adaptation (minimal diff)

**Approach**: thread the active profile through `meta.profile` (set by `loadProfile`) so adapters need **zero** signature changes — `renderAgentsMd(policies)` already receives `policies.meta`.

`src/render/agents-md.mjs` — insert after the existing header block:
```diff
    lines.push('> 本文件自动生成，请勿手动修改。');
    lines.push('> 修改规则请编辑源 policies.yaml，然后跑生成器。');
+   if (policies.meta?.profile) {
+     lines.push(`> Profile: ${policies.meta.profile.name} (${policies.meta.profile.id})`);
+   }
    lines.push('');
```
**Backward compat**: existing callers (`renderAgentsMd(policies)` with no `meta.profile`) → field absent → no line printed → existing `agents-md.test.mjs` R1-R3 + `workflows.test.mjs` assertions stay byte-identical. Adapters untouched.

---

## 6. CLI Changes (flags + examples)

**`generate.mjs` CLI** — add `--profile`:
```
node src/orchestrator/generate.mjs [--policies <path>] [--profile <id|omit>] [--dry-run]
```
- `--profile work` → loadProfile({profileName:'work'}).
- `--profile` with no value, or omitted when manifest has a `default:true` profile → loadProfile(default).
- Omitted + no profiles section in manifest → `loadPolicies` (current single-file behavior; **existing G1/G2/G3 + I-clique tests stay green**).
- Unknown profile id → exit 1, stderr JSON `{ok:false, stage:'load', errors:[...]}`.

**`inject.mjs` CLI** — add `--module`:
```
node src/core/inject.mjs --type=permission|workflow [--module <id>] [--dry-run|--apply] [--policies <manifest>] '<JSON>'
```
- Without `--module`: current behavior (inject into `policies.yaml` permissions/workflows; existing I1-I4 tests stay green).
- With `--module sudo-safety`: target `modules/<id>/module.yaml`; validate the fragment via `createModuleValidator()` (not full v2); conflict-check against the fragment's own rules (intra-module; cross-module conflicts surface at load time per F6). On `--apply`, write fragment → validate → spawn `generate` (auto-loads default profile).
- `--module unknown-id` → exit 1 (fragment file not found / not in registry).

**Usage examples**:
```bash
# Render only the "work" profile subset into platform configs
node src/orchestrator/generate.mjs --profile work

# Use the default profile (marked default:true)
node src/orchestrator/generate.mjs

# Preview a profile's rendered AGENTS.md without writing
node src/orchestrator/generate.mjs --profile work --dry-run

# Add a rule into the sudo-safety module (fragment mode), then regenerate
node src/core/inject.mjs --type=permission --module sudo-safety --apply '{"id":"docker-ask", ...}'
```

---

## 7. Migration Plan (mapping + tree)

**Decision (F4 = hand-split, resolved; F-MIGRATE = defer execution — see §15)**: the migration MAPPING + target tree is fully specified here and PROVEN via fixtures (§14 round-trip). Executing the hand-split on the real `relic/policies.yaml` is **deferred by default** because it would require modifying 2 existing tests (`workflows.test.mjs`, `cli.test.mjs` I4) that read `policies.yaml` directly — violating the "107 tests stay green unmodified" hard constraint.

**Current `relic/policies.yaml` (verified) has**: 5 perms (sudo-ask, disk-destruct-deny, windows-write-ask, webfetch-ask, external-dir-ask), 5 workflows (plan-then-build, pdf-read, download-cleanup, add-permission, add-workflow), risk_levels (low:5, medium:3, high:4).

**Proposed module split** (each module = a cohesion unit; risk levels partitioned to the module that "owns" them):

| Module | permissions | workflows | risk_levels |
|---|---|---|---|
| `sudo-safety` | sudo-ask | — | high: sudo/su |
| `disk-protect` | disk-destruct-deny, windows-write-ask | — | high: mount/umount, system dirs |
| `web-safety` | webfetch-ask, external-dir-ask | — | medium: webfetch, external paths |
| `build-hygiene` | — | plan-then-build, download-cleanup | low: all 5 low items |
| `pdf-handling` | — | pdf-read | — |
| `entry-points` (always-on) | — | add-permission, add-workflow | — |

**`entry-points`** stays always-on: every profile includes it (conversational entry workflows must be present in every rendered AGENTS.md). Alternatively keep these 2 workflows **inline in the manifest** (always-on regardless of profile) — cleaner; the manifest's `workflows:` would list add-permission/add-workflow, and modules hold the rest. **Recommended: keep entry-point workflows inline in the manifest.**

**Resulting tree (post-migration, if executed)**:
```
relic/
├── policies.yaml                  # MANIFEST: meta, profiles[], modules[] registry, inline entry-point workflows
│   # (permissions: [] inline — all live in modules)
├── modules/
│   ├── sudo-safety/module.yaml
│   ├── disk-protect/module.yaml
│   ├── web-safety/module.yaml
│   ├── build-hygiene/module.yaml
│   └── pdf-handling/module.yaml
```
**Profile examples** post-migration:
- `work`: `[sudo-safety, disk-protect, web-safety, build-hygiene]` → ~the "work" subset (drops pdf-handling) → token saving.
- `personal`: `[pdf-handling, build-hygiene]` → only pdf + cleanup → large saving.
- `full` (`modules: all`) → reproduces today's full render (round-trip equivalence).

**Fixture proof (this build)**: `tests/fixtures/manifest.yaml` + `tests/fixtures/modules/{sudo-safety,web-safety,pdf-handling}/module.yaml` mirror the `policies-good.yaml` split; round-trip test (§14 RT1) proves `render(loadProfile(manifest, default)) === render(loadPolicies(policies-good.yaml))`.

---

## 8. File-by-File Build List

| File | Action | Purpose |
|---|---|---|
| `output/v2/direction3-plan.md` | CREATE (M0) | Land this plan as the v2 doc artifact. |
| `schema.json` | MODIFY (M1) | +`profiles` property, +`meta.profile`, +`profile`/`moduleFragment` definitions (additive, no version bump). |
| `tests/fixtures/manifest.yaml` | CREATE (M1) | Manifest fixture: meta + profiles (default) + modules registry. |
| `tests/fixtures/modules/<id>/module.yaml` | CREATE (M1) | 3 fragment fixtures (sudo-safety, web-safety, pdf-handling) mirroring policies-good.yaml split. |
| `tests/fixtures/modules-bad-dupe-id/` | CREATE (M2) | 2 fragments sharing a permission id (cross-module conflict test). |
| `src/core/validator.mjs` | MODIFY (M2) | +`createModuleValidator()` for moduleFragment validation. |
| `src/core/module-loader.mjs` | CREATE (M2) | `loadProfile()` + `mergeFragments()` — the new core of direction 3. |
| `src/core/conflict.mjs` | MODIFY (M2) | +`detectCrossModuleConflicts()` all-pairs (reuses layer primitives). |
| `src/render/agents-md.mjs` | MODIFY (M3) | +optional `meta.profile` header line (3 lines). |
| `src/orchestrator/generate.mjs` | MODIFY (M4) | CLI +`--profile`; load-step branches loadProfile vs loadPolicies. `generate()` fn unchanged. |
| `src/core/inject.mjs` | MODIFY (M4) | CLI +`--module`; fragment-mode validate + write. `injectRule()` extended optatively. |
| `src/index.mjs` | MODIFY (M4) | `pipeline()` +optional `profile` routing. |
| `tests/module-loader.test.mjs` | CREATE (M2) | L1–L11 (loader/merger/cross-conflict). |
| `tests/render-profile.test.mjs` | CREATE (M3) | R4–R5 (profile header; no-profile unchanged). |
| `tests/cli-profile.test.mjs` | CREATE (M4) | G4–G6, I5–I7 (new CLI flags; isolated, existing cli.test.mjs untouched). |
| `tests/round-trip.test.mjs` | CREATE (M5) | RT1–RT2 (split→merge→render == original). |
| `relic/AGENTS.md` | MODIFY (M6) | Handoff update (§当前进度/交接说明; ≤200 lines). |

**Totals**: 1 new src file, 6 modified src/schema, 4 new test files, 5+ new fixtures, 1 plan doc, 1 handoff doc. **Zero adapter changes. Zero orchestrator core changes.**

---

## 9. Bug-Fix Mapping

**None** — direction 3 is purely additive (no predecessor bug being fixed).

**Behavior changes to note** (not bugs):
- `generate` CLI: when `policies.yaml` contains a `profiles` section + a `default:true`, running `generate` with no `--profile` now loads the default profile (merged doc) instead of the raw file. **relic's real `policies.yaml` has no `profiles` section → unaffected → existing tests green.** Only fixture manifests trigger the new path.
- `renderAgentsMd`: prints one extra header line **iff** `meta.profile` is set (only set by `loadProfile`). Single-file renders: unchanged.
- `inject` CLI: `--module` is opt-in; without it, byte-identical behavior.

---

## 10. Dependency + Tooling

**No new dependencies.** Confirmed against `package.json` (ajv@8.20.0, yaml@2.9.0, node:test, node ≥20):
- Fragment validation reuses ajv.
- YAML parse/stringify reuses `yaml`.
- `oneOf`/`const` in the new schema use ajv draft-07 native support (`validator.mjs:45` sets `strict:false`).
- No `package.json` dependency changes.

---

## 11. Task Dependency Graph + Parallel Waves

```
M0 (plan doc) ──────────────────────────────────────────────→ (doc only, no deps)
M1 (schema + fixtures) ─┬─→ M2 (loader+merger+cross-conflict) ─┐
                        └─→ M3 (renderer header) ─────────────┤
                                                             ├─→ M4 (CLI) ─┐
                                                             ├─→ M5 (round-trip) ─┤
                                                             └────────────────────┴─→ M6 (AGENTS.md)
```
Critical path: **M1 → M2 → M4 → M6** (or M1→M2→M5→M6).

| Wave | Tasks (parallel) | Unblocks |
|---|---|---|
| **W1** | M0 plan-doc · M1 schema+fixtures | W2 |
| **W2** | M2 loader+merger+cross-conflict · M3 renderer header | W3 |
| **W3** | M4 CLI (--profile/--module) · M5 round-trip fixtures | W4 |
| **W4** | M6 AGENTS.md handoff + final commit | — |

Max parallelism = 2 (W2, W3).

---

## 12. Task Specifications (delegation-ready)

TDD: each task commits tests alongside code; `npm test` stays green after each commit.

| Task | Category | Skills | Deliverable + acceptance | Deps | Effort | Commit |
|---|---|---|---|---|---|---|
| **M0** plan-doc | `writing` | — | Land this plan to `output/v2/direction3-plan.md`. | — | S | `docs: land direction 3 plan (modular+profile loading)` |
| **M1** schema+fixtures | `unspecified-high` | `programming` | `schema.json` additive changes (§3) + `tests/fixtures/manifest.yaml` + 3 module fixtures + bad-dupe fixture. QA: S1–S5 (§14). | — | M | `feat(schema): profiles + moduleFragment definitions (additive v2)` |
| **M2** loader+merger | `unspecified-high` | `programming` | `src/core/module-loader.mjs` (`loadProfile`/`mergeFragments`) + `validator.mjs` `createModuleValidator` + `conflict.mjs` `detectCrossModuleConflicts` + `tests/module-loader.test.mjs`. QA: L1–L11. | M1 | L | `feat(core): profile loader + fragment merger + cross-module conflict` |
| **M3** renderer header | `quick` | `programming` | `src/render/agents-md.mjs` +`meta.profile` line + `tests/render-profile.test.mjs`. QA: R4–R5; existing R1–R3 green. | M1 | S | `feat(render): optional profile name in AGENTS.md header` |
| **M4** CLI | `unspecified-high` | `programming` | `generate.mjs` +`--profile`; `inject.mjs` +`--module`; `index.mjs` `pipeline` +`profile`; `tests/cli-profile.test.mjs`. QA: G4–G6, I5–I7. | M2,M3 | M | `feat(cli): generate --profile + inject --module` |
| **M5** round-trip | `unspecified-high` | `programming` | `tests/round-trip.test.mjs` (RT1–RT2) proving split→merge→render == original; finalize fixture module tree. | M1,M2,M3 | M | `feat(modules): fixture module tree + round-trip migration proof` |
| **M6** handoff | `writing` | `git-master` | Update `relic/AGENTS.md` 当前进度 + 交接说明 (direction 3 done; F-MIGRATE recorded in 待澄清); ≤200 lines. Final commit. | ALL | S | `docs: update relic/AGENTS.md handoff (direction 3 complete)` |

---

## 13. Commit Strategy (atomic, conventional-commits)

7 atomic commits, one per task, staged with only that task's files (never `git add -A`), `npm test` green after each.

1. `docs: land direction 3 plan (modular+profile loading)` — M0
2. `feat(schema): profiles + moduleFragment definitions (additive v2)` — M1
3. `feat(render): optional profile name in AGENTS.md header` — M3
4. `feat(core): profile loader + fragment merger + cross-module conflict` — M2
5. `feat(cli): generate --profile + inject --module` — M4
6. `feat(modules): fixture module tree + round-trip migration proof` — M5
7. `docs: update relic/AGENTS.md handoff (direction 3 complete)` — M6

---

## 14. Success Criteria / QA Assertions (TDD, defined before build)

A task is done when its assertions pass via `npm test` AND the existing 107 stay green.

**Schema (M1)**:
- S1: `manifest.yaml` validates `ok:true`; defaults applied (`profiles` items, `modules` registry).
- S2: each `modules/<id>/module.yaml` validates as `moduleFragment` (`createModuleValidator`).
- S3: profile with `modules: all` validates; profile with `modules: [ids]` validates.
- S4: profile missing `id` (or `name`/`modules`) → rejected by ajv.
- S5: moduleFragment with a malformed permission (e.g. bare-string pattern) → rejected (reuses `permission` definition).

**Loader/Merger (M2)**:
- L1: `loadProfile(manifest, default)` returns merged doc containing ALL default-profile modules' rules.
- L2: `loadProfile(manifest, 'personal')` returns a **strict subset** (fewer permissions than default) — proves token-saving.
- L3: `loadProfile(manifest, 'unknown')` → `ok:false`, error names the unknown profile.
- L4: manifest with no `default:true` + no `profileName` → `ok:false`, error says "mark default:true or pass --profile".
- L5: `mergeFragments` is pure (no I/O; same inputs → same output across calls).
- L6: `risk_levels` merged per-level across modules (low/medium/high concatenated + deduped).
- L7: fragment whose `id` ≠ directory name → `ok:false` (triple-check fails).
- L8: profile references a module id not in registry → `ok:false` ("unknown module X").
- L9: two modules defining the same permission `id` → `ok:false`, `conflicts.idClashes` non-empty (hard error).
- L10: two modules with overlapping bash patterns (same tool, overlapping glob) but different ids → `ok:true`, `conflicts.permissionConflicts` non-empty (non-blocking warning).
- L11: `enabled:false` module in registry, referenced by profile → skipped + warning; not in merged output.

**Renderer (M3)**:
- R4: `renderAgentsMd(policiesWithMetaProfile)` output contains `> Profile: <name> (<id>)`.
- R5: `renderAgentsMd(policies)` with no `meta.profile` → byte-identical to today (existing R1–R3 + workflows tests still pass).

**CLI (M4)**:
- G4: `generate --policies <manifest-fixture> --profile work --dry-run` → exit 0, stdout JSON, fileMaps has opencode/omo/claude.
- G5: `generate --policies <manifest> --profile nope` → exit 1, stderr `stage:'load'`.
- G6: `generate --policies <manifest>` (no --profile, manifest has default) → exit 0, loads default profile.
- I5: `inject --type=permission --module sudo-safety --dry-run '<JSON>'` → exit 0, `yamlSnippet`, target = fragment path.
- I6: `inject --module sudo-safety --apply '<valid JSON>'` (isolated modules dir) → writes to `modules/sudo-safety/module.yaml`, fragment validates.
- I7: `inject --module unknown-id` → exit 1 (fragment/registry not found).
- E1: existing `cli.test.mjs` G1–G3 + I1–I4 still pass unmodified (single-file mode on real policies.yaml).

**Round-trip (M5)**:
- RT1: `renderAgentsMd(loadProfile(manifest-fixture, default).policies)` === `renderAgentsMd(loadPolicies(policies-good.yaml))` **byte-identical** (proves split→merge→render reproduces the original).
- RT2: `loadProfile` output stable across `stringify→parse` round-trip of the manifest.

**Full suite**: `npm test` exits 0 after W3, with 107 existing + ~30 new assertions all green.

---

## 15. Forks Needing User Input

**Resolved with best-practice defaults (no sign-off needed):**
- **F1** module storage → **directory-per-module** (`modules/<id>/module.yaml` + future space).
- **F2** profile location → **schema top-level `profiles`** section (single-source).
- **F3** default profile → **`default:true` field**, unspecified → use default.
- **F4** migration → **hand-split, no script**.
- **F5** granularity → **whole-module groups only** (no intra-module toggling).
- **F6** conflict scope → **full check at load time** (cross-module all-pairs; id-clash = hard error).
- **F-REGISTRY** → consume the existing `modules` schema slot as the module registry. `moduleSlot` shape already fits; removes the "dead slot" smell.
- **F-VERSION** → **stay v2, additive** (no `meta.version` bump). Backward-compatible; 107 tests stay green.
- **F-THREAD** → thread active profile via `meta.profile` (not an adapter signature change) → adapters stay untouched.

**Genuinely needs your sign-off (1 fork):**

| Fork | Options | Recommendation | Stakes |
|---|---|---|---|
| **F-MIGRATE** (execute real-file migration now vs defer) | **(a) Defer** — keep `relic/policies.yaml` as a full v2 doc; prove modular system via `tests/fixtures/` + round-trip; executing the hand-split is a later, user-triggered follow-up. Keeps all 107 existing tests unmodified + green. **(b) Execute now** — hand-split `relic/policies.yaml` into manifest + `modules/` per §7, and update 2 existing tests (`workflows.test.mjs`, `cli.test.mjs` I4) to load via `loadProfile`; their assertions stay semantically equivalent. | **(a) Defer** — honors the hard constraint "107 existing tests must keep passing" unmodified, matches the foundation phase's "migration deferred; demonstrate via fixtures" precedent, and the migration is low-effort to trigger later. | Medium — purely about test-stability vs "make modular live for relic's own sample now". No live-config risk either way. |

---

## TODO List for the Executing Agent (build phase, after approval)

- [ ] **W1·M0** Land this plan to `output/v2/direction3-plan.md`. Commit `docs: land direction 3 plan…`.
- [ ] **W1·M1** `schema.json` additive changes (§3) + `tests/fixtures/manifest.yaml` + `tests/fixtures/modules/{sudo-safety,web-safety,pdf-handling}/module.yaml` + `tests/fixtures/modules-bad-dupe-id/`. Commit `feat(schema)…`.
- [ ] **W2·M2** `src/core/module-loader.mjs` (`loadProfile`/`mergeFragments`) + `validator.mjs` `createModuleValidator` + `conflict.mjs` `detectCrossModuleConflicts` + `tests/module-loader.test.mjs` (L1–L11). Commit `feat(core)…`.
- [ ] **W2·M3** `src/render/agents-md.mjs` +`meta.profile` line + `tests/render-profile.test.mjs` (R4–R5). Commit `feat(render)…`.
- [ ] **W3·M4** `generate.mjs` +`--profile`; `inject.mjs` +`--module`; `index.mjs` `pipeline`+`profile`; `tests/cli-profile.test.mjs` (G4–G6, I5–I7). Commit `feat(cli)…`.
- [ ] **W3·M5** `tests/round-trip.test.mjs` (RT1–RT2); finalize fixture module tree to byte-identical round-trip. Commit `feat(modules)…`.
- [ ] **W4·M6** Update `relic/AGENTS.md` 当前进度 + 交接说明 (direction 3 done) + record F-MIGRATE in 待澄清 (≤200 lines). Final commit `docs: update relic/AGENTS.md handoff…`.
