# Migration Strategy Plan — relic ↔ agent-governance

**Version:** v3.0 (migration-strategy)
**Date:** 2026-08-27
**Phase:** Plan-only (READ-ONLY). No edits, no live-config touches. Output target: `/mnt/e/AIworkspace/relic/output/v3/migration-strategy-plan.md`.
**Status:** Awaiting user go/no-go. The prerequisite fixes (GAP1/GAP2) are NOT implemented here — they belong to a later approved build phase.

---

## 1. Executive Summary

**Recommendation (one sentence):** Do **not** cut over yet — adopt **Strategy B (Symlink Transition)**, but only *after* the GAP1+GAP2 deep-merge prerequisite fixes land, because relic's two installers currently whole-file-replace `~/.omo/omo.jsonc` and `~/.config/opencode/opencode.jsonc`, which would destroy `model`/`fallback_models`/`provider`/`sharing` and all non-governance config on first run.

**Rationale:** relic has already proven its value as a *portable, multi-target generator* (schema v2, ajv validator, 3 adapters, F-MIGRATE lossless round-trip, 167 green tests). But "generates correct content" ≠ "installs safely." The live `install.sh` does two deep-merges (`install.sh:94`, `install.sh:146`) that preserve user fields; relic's adapters do zero merges — they `writeWithHeader()` over the entire file (`omo.mjs:89`, `opencode.mjs:81`). That single asymmetry is the entire migration risk surface. A symlink-transition lets relic become the *source* for generated artifacts while the live runtime keeps installing via the proven merge path until relic's installers are merge-safe and equivalence is proven by diff. Rollback is one `unlink`.

---

## 2. Current State Comparison Matrix

| Dimension | agent-governance (LIVE) | relic (SUCCESSOR) | Delta / Risk |
|---|---|---|---|
| **Source structure** | single `policies.yaml` (218 lines): meta+permissions+workflows+risk_levels | manifest(70)+5 modules(142)=212 lines; schema v2; ajv-validated | relic is more structured & validated; content scales match |
| **Generate outputs** | `generate.mjs` (353 lines) → 4 files: `omo.permission.jsonc`, `opencode.agent.jsonc`, `claude.hooks.json`, `AGENTS.md` | 3 adapters → `omo.permission.jsonc`, `opencode.agent.jsonc`, `AGENTS.md` (no `claude.hooks.json` — dropped per F1) | relic intentionally drops hooks; equivalence must be proven for the 3 kept files |
| **Install: omo.jsonc** | **DEEP-MERGE** — `install.sh:86-95`: injects only `.permission` into `[opencode].agents.<name>.permission`, preserves `model`/`fallback_models`/others | **WHOLE-FILE REPLACE** — `omo.mjs:89` `writeWithHeader()` overwrites entire file; generate (`omo.mjs:52-71`) emits flat `{agent:{permission}}` **without** the `[opencode].agents` wrapper | 🚨 **DESTRUCTIVE** — would wipe `model`/`fallback_models` + all non-permission config |
| **Install: opencode.jsonc** | **MERGE** — `install.sh:144-146`: `oc.agent = {...(oc.agent||{}), ...genAgent}`, preserves `provider`/`model`/`sharing`/top-level | **WHOLE-FILE REPLACE** — `opencode.mjs:81` `writeWithHeader()` overwrites entire file; fileMap only has `{general/build/explore:{mode,permission}}` | 🚨 **DESTRUCTIVE** — would wipe `provider`/`model`/`sharing` + all top-level config |
| **Install: AGENTS.md** | **SYMLINK** — `install.sh` symlinks `generated/AGENTS.md` → `~/.config/opencode/AGENTS.md` | **WRITE** — `opencode.mjs:90+` writes directly (cross-platform, no symlink) | Functionally equivalent; relic's write is simpler but diverges from live (symlink → written file). Reversible via backup. |
| **Skills handling** | `install.sh:173-190` symlinks `skills/permission` + `skills/workflow` → `~/.config/opencode/skill/` | **NONE** — no symlink step; decision A3 renders conversational entry as a *workflow inside AGENTS.md* (portable, not OpenCode-specific) | ⚠️ Open decision: are the two skills still needed, or does A3's workflow-rendering replace them? |
| **Rollback** | `rollback-plan-then-build.sh` + `backups/` dir | **NONE** | ⚠️ Must add before cutover |
| **Test coverage** | none (single shell script) | 167 tests, all green; F-MIGRATE round-trip lossless on relic's *own* split→merge→render | relic proven for self-round-trip, **not** yet for equivalence vs *live* `policies.yaml` |
| **Portability** | OpenCode-only (hardcoded paths, symlinks, .sh) | 3 adapters (opencode/omo/claude); .mjs+JSDoc, node>=20, no symlinks on install | relic's core reason to exist |
| **Conversational rule entry** | `lib/inject-rule.mjs` + `lib/detect-conflict.mjs` (skills) | `src/core/inject.mjs` + `conflict.mjs` + workflow-rendered entry (A3) | relic reimplemented "better" per A3 |

> **The crux, stated three ways so it cannot be missed:**
> 1. Live install = **merge 2 fields, leave everything else untouched.**
> 2. relic install = **overwrite 2 whole files, keep nothing.**
> 3. Running `relic generate` then `relic install` today = **data loss in `omo.jsonc` + `opencode.jsonc`.**

---

## 3. Critical Gap Analysis

### 🚨 GAP 1 (SEVERE) — omo adapter: whole-file replace, no deep-merge, no wrapper

- **relic code:** `src/adapters/omo.mjs`
  - generate `:52-71` → builds `result[agent] = { permission: {} }` (flat, **no `[opencode].agents` wrapper**)
  - install `:86-90` → `writeWithHeader(configPath, fileMap['omo.permission.jsonc'])` overwrites **entire** `~/.omo/omo.jsonc`
- **live equivalent:** `install.sh:86-95`
  - `if (!omo['[opencode]']) omo['[opencode]'] = {};` … `if (!omo['[opencode]'].agents) …`
  - `existing.permission = { ...(existing.permission || {}), ...newPerm };` — preserves `model`, `fallback_models`, all other agent fields
- **Blast radius if ignored:** first `relic install` run **destroys** `model`/`fallback_models` and every non-permission field in `omo.jsonc`. Agent falls back to default model; user-tuned overrides lost. Affects every OpenCode session immediately.
- **Fix sketch (build phase, NOT now):**
  1. `generate()` emits the **real nested shape**: `{ '[opencode]': { agents: { <name>: { permission: {...} } } } }`.
  2. `install()` reads existing `omo.jsonc`, parses JSONC, deep-merges: `existing.agents[name].permission = {...existing.permission, ...newPerm}`, preserving `model`/`fallback_models`/others.
  3. Write back with header. Add test asserting a seeded `model: 'glm-5.2'` survives install.

### 🚨 GAP 2 (SEVERE) — opencode adapter: whole-file replace, no merge

- **relic code:** `src/adapters/opencode.mjs`
  - install `:76-87` → `writeWithHeader(configPath, fileMap['opencode.agent.jsonc'])` overwrites **entire** `~/.config/opencode/opencode.jsonc`
  - fileMap content = only `{ general/build/explore: { mode, permission } }` — **no `provider`/`model`/`sharing`**
- **live equivalent:** `install.sh:144-146` → `oc.agent = { ...(oc.agent || {}), ...genAgent };` — preserves `provider`, `model`, `sharing`, all top-level keys
- **Blast radius if ignored:** first `relic install` run **destroys** `provider`/`model`/`sharing` and every top-level key in `opencode.jsonc`. OpenCode may fail to start or lose its provider config entirely.
- **Fix sketch (build phase, NOT now):**
  1. `install()` reads existing `opencode.jsonc`, parses JSONC.
  2. `oc.agent = { ...(oc.agent || {}), ...genAgent }` (and/or scoped per-agent merge if stricter preservation is wanted).
  3. Write back with header. Test: seeded `provider: {...}` + `sharing: {...}` survive install.

### ⚠️ GAP 3 (MEDIUM) — no skills-symlink step (decision-dependent)

- **relic code:** absent — no equivalent of `install.sh:173-190` (symlinks `skills/permission` + `skills/workflow` → `~/.config/opencode/skill/`)
- **live equivalent:** `install.sh:173-190`
- **Context:** decision A3 models conversational rule entry as a **workflow rendered into AGENTS.md** (portable to Claude/Codex/Cursor), *not* as a separate OpenCode `.skill/` file. So the skills may be **obsolete by design**.
- **Blast radius if ignored (and skills ARE still needed):** user loses the `/permission` and `/workflow` slash-command entry points; conversational rule-add breaks.
- **Blast radius if ignored (and skills are NOT needed):** none — A3's workflow-rendering already covers it.
- **Fix sketch:** **decision first** (Section 11). If "keep skills" → add a 4th adapter step that symlinks (or copies) `skills/permission`+`skills/workflow`. If "drop skills" → document A3 as the replacement; no code.

### ⚠️ GAP 4 (MINOR) — no rollback script / no `backups/`

- **relic code:** absent — no equivalent of `rollback-plan-then-build.sh` or `backups/` dir
- **live equivalent:** `agent-governance/rollback-plan-then-build.sh` + `backups/`
- **Note:** relic's adapters *do* call `backup(configPath, opts)` per-file before writing (`omo.mjs:87`, `opencode.mjs:79`) — so point-in-time backups exist; there's just no *restore* script.
- **Blast radius if ignored:** a bad cutover requires manual restore from the per-file backups. Recoverable but error-prone.
- **Fix sketch:** add `scripts/rollback.mjs` (or `.sh`) that restores the newest backup for each written path; add a `--restore` flag to `generate.mjs` install. Test: write garbage, rollback, assert file equals pre-install.

---

## 4. Content Equivalence Verification Method

Goal: prove relic can produce governance **equivalent to live**, without touching the live runtime. Two-tier pass criteria.

### Tier 1 — Generate-only equivalence (no install, safe to run anytime)
1. Snapshot live artifacts: `cp ~/.config/opencode/agent-governance/generated/{omo.permission.jsonc,opencode.agent.jsonc,AGENTS.md} /tmp/relic-equiv/live/`
2. Load live source into relic: `node src/orchestrator/generate.mjs --policies ~/.config/opencode/agent-governance/policies.yaml --profile full --dry-run` (dry-run = no writes)
3. Capture relic's fileMaps to `/tmp/relic-equiv/relic/`
4. `diff` each pair.
   - **Pass:** the two `omo.permission.jsonc` are semantically equal (note: relic currently emits flat shape — GAP1 wrapper fix will change this; run Tier 1 *after* GAP1 generate-shape fix to get a fair compare). `opencode.agent.jsonc` and `AGENTS.md` should diff clean or only in header/comment lines.
   - **Fail:** any rule in live `policies.yaml` missing from relic output, or vice versa.

### Tier 2 — Install-semantics equivalence (requires GAP1+GAP2 fixed)
1. Clone the live `omo.jsonc` + `opencode.jsonc` into a **temp home** (`HOME=/tmp/relic-fakehome`).
2. Seed the fakehome configs with `model`, `fallback_models`, `provider`, `sharing` sentinel values.
3. Run `node src/orchestrator/generate.mjs --policies <relic-manifest> --profile full` against the fakehome.
4. Assert: sentinel fields **still present** after install; `.permission`/`.agent` keys match live-generated values.
5. **Pass:** zero sentinel loss + permission equivalence.
6. **Fail:** any sentinel missing → merge bug.

### Pass criteria (overall)
- Tier 1: 3 artifacts diff-clean (modulo header comments) **and** rule-count parity (live permissions count == relic permissions count, same enforcement distribution).
- Tier 2: 4 sentinels (`model`, `fallback_models`, `provider`, `sharing`) preserved; permission values equal to live `generated/omo.permission.jsonc`.
- `node --test` → 167+ green (existing + new merge tests).

---

## 5. Three Strategy Options

### Option A — In-place Replacement
Replace `agent-governance/install.sh` with `relic generate + relic install` as the single installer immediately.

- **Prerequisites:** GAP1 + GAP2 fixed and Tier-2 passed. **Without these, Option A is unsafe.**
- **Steps (post-fix):** (1) relic generate → `generated/`; (2) `relic install` writes `omo.jsonc`+`opencode.jsonc`+`AGENTS.md`; (3) handle skills per Section 11 decision; (4) archive `~/.config/opencode/agent-governance/`.
- **Risks:** single cutover = big-bang; if merge has an edge case, both live configs corrupted at once. No parallel-run safety net.
- **Rollback:** restore from `backups/`, re-run live `install.sh`.
- **Effort:** M (the fixes) + S (the cutover).
- **Trigger conditions:** user wants one system only, *and* GAP1/GAP2 done, *and* Tier-1+Tier-2 pass, *and* rollback drill passes.

### Option B — Symlink Transition (RECOMMENDED)
relic becomes the **source/generator**; live `install.sh` remains the **installer** during transition. relic's `generated/` is symlinked into the live `generated/` so the live installer consumes relic's output. relic's own `install` path stays unused until its merges are fixed and proven.

- **Prerequisites:** Tier-1 generate-only equivalence passes (does not need GAP1/GAP2, because install still goes through live `install.sh`'s safe merges).
- **Steps:**
  1. `relic generate` produces `generated/{omo.permission.jsonc,opencode.agent.jsonc,AGENTS.md}`.
  2. Point live `install.sh` at relic's `generated/` (either symlink `agent-governance/generated → relic/generated` or edit `GEN=` path in `install.sh`).
  3. Run live `install.sh` → its proven deep-merges apply relic's content safely.
  4. Once GAP1+GAP2 fixed + Tier-2 passes, switch the installer from live `install.sh` to `relic install` (this is the actual cutover — now safe).
  5. Archive live `install.sh`.
- **Risks:** two-source confusion (which `generated/` is canonical?) — mitigate with the symlink (one source of truth). Live `install.sh`'s merge logic must still match relic's new wrapper shape (GAP1 generate fix emits `[opencode].agents.<name>.permission` — which is *exactly* what live `install.sh:87-94` expects). Verify shape compatibility at Tier-1.
- **Rollback:** `unlink` the symlink → live `generated/` authoritative again. Zero data loss.
- **Effort:** S (transition) + M (later GAP1/GAP2 + cutover).
- **Trigger conditions:** user wants to de-risk migration, accept a transitional two-system period, and prove equivalence before committing install semantics to relic.

### Option C — Long-term Coexistence
relic stays a *generator/validator* (dev-time lint + dry-run preview); live `install.sh` + `policies.yaml` remain the runtime. relic never takes over install.

- **Prerequisites:** none beyond current state.
- **Steps:** use relic `--dry-run` + ajv validation as a pre-commit governance linter on `policies.yaml`; live `install.sh` installs as today.
- **Risks:** permanent dual-maintenance; relic's install path rots (untested in production); the "portable successor" goal is never realized.
- **Rollback:** N/A (nothing changed).
- **Effort:** S ongoing.
- **Trigger conditions:** user decides portability/install takeover isn't worth the risk; relic becomes a validation-only tool.

---

## 6. Recommended Strategy + Rationale + Trigger Conditions

**Recommended: Option B — Symlink Transition.**

**Rationale against the gaps:**
- **GAP1 + GAP2 (the destroyers):** Option B sidesteps them entirely during transition — install still runs through live `install.sh`'s proven merges (`install.sh:94`, `:146`). relic's destructive `writeWithHeader` path is **never invoked** until the fixes land. This is the only option that lets us start using relic's superior generation *today* without any data-loss risk.
- **GAP3 (skills):** low urgency under B — live `install.sh:173-190` keeps symlinking the skills throughout the transition, so no behavior change. The A3 decision (drop skills, use workflow-rendering) can be made later, decoupled from the cutover.
- **GAP4 (rollback):** under B, the live `backups/`+`rollback-plan-then-build.sh` remain in effect; adding relic's own rollback becomes a nice-to-have for the eventual Option-A cutover, not a blocker now.
- **Equivalence:** Tier-1 (generate-only) is sufficient to enter Option B. Tier-2 (install-semantics) gates the *final* cutover step (B→A), giving a natural, gated progression.

**Trigger conditions for entering Option B:**
1. Tier-1 generate-only equivalence passes (3 artifacts diff-clean modulo headers).
2. GAP1 generate-shape fix emits `[opencode].agents.<name>.permission` (so live `install.sh` can consume it) — *or* confirm live `install.sh` tolerates the flat shape (it reads `agentOverride.permission` at `install.sh:93`; shape compatibility verified at Tier-1).
3. User approves the transitional two-system period.

**Trigger conditions for the final cutover (B → A, i.e. switch installer to `relic install`):**
1. GAP1 + GAP2 fixed.
2. Tier-2 install-semantics equivalence passes (4 sentinels preserved).
3. GAP4 rollback script exists + rollback drill passes.
4. GAP3 decided (skills kept or dropped per A3).

> Immediate in-place replacement (Option A now) is **explicitly NOT recommended** — GAP1+GAP2 make it unsafe. This plan does not authorize executing migration without those fixes.

---

## 7. Prerequisite Work Checklist (for a LATER approved build phase — do NOT implement now)

Each item is a concrete, file:line-targeted, TDD-ordered task. Listed in dependency order.

- [ ] **P1 — omo adapter deep-merge + wrapper (GAP1 fix)**
  - Test first (failing): `test/adapters/omo-merge.test.mjs` — seed `omo.jsonc` with `{ '[opencode]': { agents: { build: { model: 'glm-5.2', fallback_models: ['x'], permission: { bash: 'allow' } } } }, other: 1 }`; run `install`; assert `model`, `fallback_models`, `other` survive and `permission.bash==='allow'`.
  - Generate fix: `src/adapters/omo.mjs:52-71` → emit `{ '[opencode]': { agents: { <name>: { permission } } } }`.
  - Install fix: `src/adapters/omo.mjs:86-90` → read+parse existing JSONC, merge per `install.sh:87-94`, write back with header.
  - Acceptance: new test green; existing 167 stay green.
- [ ] **P2 — opencode adapter merge (GAP2 fix)**
  - Test first (failing): `test/adapters/opencode-merge.test.mjs` — seed `opencode.jsonc` with `{ provider: {...}, model: 'm', sharing: {...}, agent: { build: { mode: 'diff' } } }`; run `install`; assert `provider`/`model`/`sharing` survive and `agent.build.permission` injected.
  - Install fix: `src/adapters/opencode.mjs:76-87` → read+parse, `oc.agent = {...(oc.agent||{}), ...genAgent}`, write back with header.
  - Acceptance: new test green; existing 167 stay green.
- [ ] **P3 — rollback script (GAP4)**
  - Test first: write garbage to a fakehome config, run rollback, assert equals pre-install.
  - Add `scripts/rollback.mjs` (or extend `generate.mjs --restore`) restoring newest backup per path (`omo.mjs:87`, `opencode.mjs:79` already create backups).
  - Acceptance: rollback drill restores all 3 paths.
- [ ] **P4 — skills decision + (if kept) symlink step (GAP3)** — *blocked on user decision (Section 11)*
  - If keep: add adapter step mirroring `install.sh:173-190` (symlink or copy `skills/permission`+`skills/workflow`).
  - If drop: document A3 workflow-rendering as the replacement in relic `AGENTS.md`.
- [ ] **P5 — Tier-1 equivalence harness (generate-only)**
  - Script: load live `policies.yaml` into relic `generate --dry-run`, diff 3 artifacts vs live `generated/`.
  - Acceptance: diff-clean modulo headers; rule-count parity.
- [ ] **P6 — Tier-2 equivalence harness (install-semantics, fakehome)** — *depends on P1+P2*
  - Script: fakehome + 4 sentinels; `relic install`; assert sentinels survive.
  - Acceptance: 4 sentinels preserved; permission values match live.

(P1, P2, P3 are independent → parallelizable. P5 is independent. P6 depends on P1+P2. P4 is decision-gated. See Execution Plan appendix.)

---

## 8. Migration Execution Steps (post-approval, post-prereqs)

Ordered, with verification gates. Each gate must pass before the next step.

1. **(build phase)** Implement P1, P2, P3, P5 in parallel; P6 after P1+P2; P4 after user decision.
   - Gate: P1+P2 tests green; P5 Tier-1 passes; P6 Tier-2 passes; P3 rollback drill passes.
2. **(enter Option B)** Symlink `agent-governance/generated → relic/generated` (or set `GEN=` path in `install.sh`).
   - Gate: `ls -l generated` shows relic; live `install.sh` runs clean; `relic --dry-run` output == live `generated/` (Tier-1).
3. **(run transitionally)** Use relic as generator, live `install.sh` as installer, for N sessions.
   - Gate: user confirms no regression over N sessions.
4. **(cutover B→A)** Run `relic install` against real `HOME` (GAP1/GAP2 now fixed).
   - Gate: Tier-2 passes on real configs; sentinels (`model`/`fallback_models`/`provider`/`sharing`) present post-install; `node --test` green.
5. **(archive live)** Move `~/.config/opencode/agent-governance/install.sh` + `generate.mjs` to `agent-governance/legacy/`; keep `policies.yaml` only if relic manifest is its successor.
   - Gate: `relic generate + relic install` is the sole path; `install.sh` no longer referenced.
6. **(rollback drill)** From step 4/5, simulate failure → run P3 rollback → restore.
   - Gate: full restore to pre-step-4 state.

---

## 9. Verification Standards

- **Round-trip lossless:** relic's own split→merge→render already proven (F-MIGRATE). Re-run F-MIGRATE suite post-fixes → still lossless.
- **Live config not destroyed:** Tier-2 sentinel test (`model`/`fallback_models`/`provider`/`sharing`) — the **non-negotiable** gate. If any sentinel missing after `relic install`, migration is blocked.
- **Tests all green:** `node --test` → 167 (existing) + new merge/rollback tests, 0 failing.
- **Equivalence:** Tier-1 diff-clean; rule-count parity (permissions count + enforcement distribution) between live `policies.yaml` and relic manifest+modules.
- **Rollback drill:** from a simulated broken cutover, P3 restores all 3 written paths to byte-equality with pre-install (modulo header timestamp).

---

## 10. Rollback Plan

If migration breaks the live runtime:

1. **Immediate (seconds):** if using Option B (recommended), `unlink ~/.config/opencode/agent-governance/generated` → live `generated/` authoritative again; re-run `install.sh`. Runtime restored, zero data loss.
2. **If past the cutover (Option A / B→A):** run `scripts/rollback.mjs` (P3) → restore newest per-file backup for `omo.jsonc` + `opencode.jsonc` + `AGENTS.md`.
3. **If backups insufficient:** `~/.config/opencode/agent-governance/backups/` + `rollback-plan-then-build.sh` still exist (untouched during planning) → run live rollback.
4. **Git:** relic repo `git revert` the cutover commit; `agent-governance` repo at `b830ca6` — `git reset --hard b830ca6` if its working tree was disturbed.
5. **Verify:** `cat ~/.omo/omo.jsonc` shows `model`/`fallback_models`; `cat ~/.config/opencode/opencode.jsonc` shows `provider`/`model`/`sharing`. OpenCode starts and runs a sample agent turn.

---

## 11. Open Decision Points for User

Only the user can resolve these:

1. **Skills (GAP3):** Are `skills/permission` + `skills/workflow` still needed as OpenCode `.skill/` files, given A3 renders the conversational rule-entry as a workflow inside `AGENTS.md` (portable to Claude/Codex/Cursor)? Keep → P4 adds a symlink step. Drop → A3 is the replacement, no code.
2. **Second target platform:** relic has 3 adapters (opencode/omo/claude). Is Claude/Codex/Cursor a real near-term target, or is OpenCode the only install target for now? Affects whether `claude` adapter output needs equivalence proofing too.
3. **`output/` git-tracking:** should `relic/output/v3/` (this doc + future plan docs) be committed to the relic repo, or kept local/untracked? Affects commit strategy.
4. **Transition duration (Option B):** how many sessions (N) before B→A cutover? (step 3 gate).
5. **`policies.yaml` retirement:** once relic manifest+modules is the proven successor, is live `policies.yaml` archived, or kept as a read-only compatibility shim?
6. **Strictness of opencode merge (P2):** live does a shallow `oc.agent = {...(oc.agent||{}), ...genAgent}` (whole `agent` key replaced, other agents preserved). Should relic match exactly, or do a stricter per-agent deep-merge (preserve each agent's non-permission fields)? Affects P2 test shape.

---

## Appendix — Execution Plan (prerequisite build phase)

> This appendix governs the LATER approved build phase (P1–P6), NOT the current plan-only phase. It exists to make the prerequisite work dispatchable as parallel sub-agent tasks once the user says "build."

### Task Dependency Graph

| Task | Depends On | Reason |
|------|------------|--------|
| P1 omo deep-merge | None | Single-adapter fix; spec is self-contained |
| P2 opencode merge | None | Single-adapter fix; spec is self-contained |
| P3 rollback script | None | Independent tooling; reads existing backup() outputs |
| P5 Tier-1 harness | None | Generate-only; no install needed |
| P4 skills step | None (code) / User decision (gate) | Code is trivial *if* decision = keep; blocked until Section-11 Q1 answered |
| P6 Tier-2 harness | P1, P2 | Must install through the fixed merges to assert sentinels survive |
| Cutover (step 4) | P1, P2, P3, P6 | Needs safe install + rollback + equivalence |

### Parallel Execution Graph

```
Wave 1 (start immediately, no deps):
├── P1: omo adapter deep-merge + wrapper (TDD)
├── P2: opencode adapter merge (TDD)
├── P3: rollback script (TDD)
└── P5: Tier-1 generate-only equivalence harness

Wave 2 (after Wave 1):
└── P6: Tier-2 install-semantics harness (depends: P1, P2)

Wave 3 (after Wave 2 + user decision Q1):
└── P4: skills symlink step OR A3 documentation (decision-gated)

Wave 4 (after Wave 2 + P3 drill + P6 pass):
└── Cutover B→A (step 4) — main-assistant only, live runtime

Critical path: P1 → P6 → Cutover (P2 parallel; P3/P5 independent)
Estimated parallel speedup vs sequential: ~45%
```

### Category + Skills Recommendations (per task)

- **P1 omo deep-merge:** Category `deep` (merge semantics + JSONC + preserving arbitrary fields is subtle; one goal, one deliverable). Skills: `programming` (mandatory: .mjs). Omit `debugging` (no runtime bug yet — TDD builds green-first). Omit `refactor` (new logic, not restructure).
- **P2 opencode merge:** Category `deep`. Skills: `programming`. Same rationale as P1.
- **P3 rollback script:** Category `unspecified-high`. Skills: `git-master` (backup/restore + git revert discipline). Omit `programming` (shell/mjs glue, not core .mjs logic).
- **P5 Tier-1 harness:** Category `quick`. Skills: none (run node + diff). Omit all — investigation scripting.
- **P6 Tier-2 harness:** Category `deep`. Skills: `programming` (fakehome setup + assertions in .mjs). Omit `debugging` (verification, not repair).
- **P4 skills step:** Category `quick` (if keep: symlink/copy mirror of `install.sh:173-190`). Skills: none. Omit `programming` (symlink op, not .mjs logic).

### Atomic Commit Strategy

One commit per task, TDD order (test commit may be folded into the impl commit if repo convention prefers atomic feature commits):

1. `test(adapters): failing omo deep-merge sentinel test` *(red)*
2. `fix(adapters/omo): deep-merge permission, preserve model/fallback (GAP1)` *(green)* — P1
3. `test(adapters): failing opencode merge sentinel test` *(red)*
4. `fix(adapters/opencode): merge agent, preserve provider/model/sharing (GAP2)` *(green)* — P2
5. `feat(scripts): rollback.mjs restore-from-backup + drill (GAP4)` — P3
6. `test(equiv): Tier-1 generate-only equivalence harness` — P5
7. `test(equiv): Tier-2 install-semantics sentinel harness` — P6 (depends on 2,4)
8. `feat(adapters): skills symlink step (GAP3)` *— only if Q1 = keep* — P4
9. *(cutover, main-assistant only, not a relic commit)*

Each commit: `node --test` green before push. No commit touches `~/.config/opencode/agent-governance/` or the live `omo.jsonc`/`opencode.jsonc`.

---

## Success Criteria (overall migration)

- ✅ GAP1 + GAP2 fixed; `model`/`fallback_models`/`provider`/`sharing` survive `relic install` (Tier-2).
- ✅ Tier-1 generate-only equivalence: relic output diff-clean vs live `generated/`.
- ✅ `node --test` 167+ green.
- ✅ Rollback drill restores all 3 paths to byte-equality.
- ✅ Live runtime behavior unchanged over N transitional sessions (Option B).
- ✅ `relic generate + relic install` is the sole governance path; live `install.sh` archived.

---

*End of plan. Awaiting user go/no-go. No edits made; live `agent-governance/` untouched.*
