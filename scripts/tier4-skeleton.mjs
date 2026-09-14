// =============================================================================
// scripts/tier4-skeleton.mjs — 骨架门禁 CLI（Tier4）
// =============================================================================
// 用法：
//   node scripts/tier4-skeleton.mjs                    # CI 模式：断言 A + B(HEAD vs HEAD~1)
//   node scripts/tier4-skeleton.mjs --sync-check       # sync 模式：断言 A + B(对比 .last-sync 记录)
//   node scripts/tier4-skeleton.mjs --bump-golden      # 系统变更仪式：以当前探针渲染重写 golden
//                                                      #（必须与 renderer 改动同一提交！）
// 退出码：0=通过，1=违法/漂移
// =============================================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { parse } from 'yaml';
import { renderAgentsMd } from '../src/render/agents-md.mjs';
import { loadProfile } from '../src/core/module-loader.mjs';
import { buildProbePolicies, extractSkeletonLines, assertGolden, checkImmutability } from '../src/core/skeleton.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = resolve(REPO, 'tests/fixtures/golden-skeleton.md');

const readGolden = () => readFileSync(GOLDEN, 'utf8');
const renderReal = (policiesPath) => {
  const r = loadProfile({ manifestPath: policiesPath ?? resolve(REPO, 'policies.yaml') });
  if (!r.ok) throw new Error('loadProfile failed: ' + r.errors.join('; '));
  return renderAgentsMd(r.policies);
};

const sh = (cmd, cwd = REPO) => {
  const r = spawnSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', env: { ...process.env, GIT_ASKPASS: '', GIT_TERMINAL_PROMPT: '0' } });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
};

const args = process.argv.slice(2);

// ---- 系统变更仪式：重写 golden ----
if (args.includes('--bump-golden')) {
  const probeRender = renderAgentsMd(buildProbePolicies());
  mkdirSync(dirname(GOLDEN), { recursive: true });
  writeFileSync(GOLDEN, probeRender);
  console.log('[tier4] golden bumped (' + probeRender.length + ' bytes) — commit together with the renderer change.');
  process.exit(0);
}

const goldenText = readGolden();
const failures = [];

// ---- 断言 A：等价 ----
const probeRender = renderAgentsMd(buildProbePolicies());
const a = assertGolden(probeRender, goldenText);
if (!a.ok) failures.push('A: ' + a.reason);

// ---- 骨架行集 + 唯一性 ----
const { lines: skeletonLines, unique } = extractSkeletonLines(goldenText);
if (!unique) failures.push('A: golden skeleton lines contain duplicates (ambiguous matching)');

const renderNow = renderReal();

if (args.includes('--sync-check')) {
  // ---- sync 模式：对比 .last-sync 记录 ----
  const statePath = resolve(REPO, '.last-sync');
  let prevSkeletonSha = null, prevGoldenSha = null;
  if (existsSync(statePath)) {
    try {
      const st = JSON.parse(readFileSync(statePath, 'utf8'));
      prevSkeletonSha = st.skeletonSha ?? null;
      prevGoldenSha = st.goldenSha ?? null;
    } catch { /* 损坏状态视为首次 */ }
  }
  const b = checkImmutability({ renderNowText: renderNow, skeletonLines, goldenText, prevSkeletonSha, prevGoldenSha });
  if (!b.ok) failures.push('B: ' + b.reason);
  // 输出新状态供 sync.mjs 持久化
  console.log(JSON.stringify({ skeletonSha: b.skeletonSha, goldenSha: b.goldenSha, systemChange: !!b.systemChange }));
} else {
  // ---- CI 模式：HEAD vs HEAD~1 ----
  const hasParent = sh('git rev-parse --verify HEAD~1').ok;
  if (hasParent) {
    // golden 是否在本提交范围被 bump（合法系统变更标志）
    const goldenBumped = sh('git diff --name-only HEAD~1 HEAD -- tests/fixtures/golden-skeleton.md').out.trim() !== '';
    // 用 HEAD~1 树构造上一版 render
    const prevDir = join(tmpdir(), 'relic-tier4-prev-' + Date.now());
    mkdirSync(join(prevDir, 'modules'), { recursive: true });
    writeFileSync(join(prevDir, 'policies.yaml'), sh('git show HEAD~1:policies.yaml').out);
    const modIds = sh("git ls-tree --name-only HEAD~1 modules/").out.trim().split('\n')
      .map((s) => s.replace(/\/$/, '').split('/').pop())
      .filter(Boolean);
    for (const id of modIds) {
      if (!id) continue;
      mkdirSync(join(prevDir, 'modules', id), { recursive: true });
      const c = sh(`git show HEAD~1:modules/${id}/module.yaml`);
      if (c.ok && c.out.trim() !== '') writeFileSync(join(prevDir, 'modules', id, 'module.yaml'), c.out);
    }
    try {
      const renderPrev = renderReal(join(prevDir, 'policies.yaml'));
      const { createHash } = await import('crypto');
      const h = (t) => createHash('sha256').update(t).digest('hex');
      const prevSk = skeletonLinesOf_prev(renderPrev);
      function skeletonLinesOf_prev(text) {
        const set = new Set(skeletonLines);
        return text.split('\n').filter((l) => set.has(l));
      }
      if (h(prevSk.join('\n')) !== h(skeletonLinesOf_prev(renderNow).join('\n')) && !goldenBumped) {
        failures.push('B: skeleton lines changed in this commit while golden was not bumped (user-zone commit touching skeleton — illegal)');
      }
    } catch (e) {
      failures.push('B: failed to render HEAD~1 tree: ' + e.message);
    }
  }
}

if (failures.length === 0) {
  console.log('[tier4] skeleton gate PASS — A(equivalence) + B(immutability)');
  process.exit(0);
}
for (const f of failures) console.error('[tier4] FAIL ' + f);
process.exit(1);
