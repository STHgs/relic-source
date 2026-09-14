// =============================================================================
// tests/skeleton.test.mjs — 骨架门禁（Tier4）逻辑测试：三绿三红
// =============================================================================
// K1 绿：探针策略 schema 合法 + 断言 A 字节等价 + 骨架行集唯一
// K2 绿：不变性合法路径（首次 / 纯用户区变更 / renderer+golden 系统变更）
// K3 红：摘哨兵→拒；改固定话术→拒；renderer 漂移无 golden bump→A 拒
// =============================================================================
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { renderAgentsMd } from '../src/render/agents-md.mjs';
import { createValidator } from '../src/core/validator.mjs';
import {
  buildProbePolicies, extractSkeletonLines, skeletonLinesOf, hashLines,
  assertGolden, checkImmutability, PROBE_MARK,
} from '../src/core/skeleton.mjs';

const golden = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/golden-skeleton.md'), 'utf8');
const probe = buildProbePolicies();
const sk = extractSkeletonLines(golden).lines;
const skOf = (t) => skeletonLinesOf(t, sk);

describe('K1: golden equivalence (green)', () => {
  it('probe policies pass schema v2', () => {
    const v = createValidator()(probe);
    assert.equal(v.ok, true, (v.errors || []).join('; '));
  });
  it('A: render(probe) === golden byte-for-byte', () => {
    assert.equal(assertGolden(renderAgentsMd(probe), golden).ok, true);
  });
  it('skeleton lines unique and substantial', () => {
    const { lines, unique } = extractSkeletonLines(golden);
    assert.ok(unique, 'skeleton lines must be unique');
    assert.ok(lines.length >= 30, `expected >=30 skeleton lines, got ${lines.length}`);
    assert.ok(lines.some((l) => l.includes('RELIC IS RUNNING')));
  });
});

describe('K2: immutability legal paths (green)', () => {
  it('first run (no prior state) passes and returns hashes', () => {
    const r = checkImmutability({ renderNowText: golden, skeletonLines: sk, goldenText: golden, prevSkeletonSha: null, prevGoldenSha: null });
    assert.equal(r.ok, true);
    assert.match(r.skeletonSha, /^[0-9a-f]{64}$/);
    assert.match(r.goldenSha, /^[0-9a-f]{64}$/);
  });
  it('user-zone change (extra risk item) keeps skeleton hash', () => {
    const mutated = renderAgentsMd({
      ...probe,
      risk_levels: { low: [PROBE_MARK, 'brand new user low-risk item'], medium: [PROBE_MARK], high: [PROBE_MARK] },
    });
    assert.equal(hashLines(skOf(mutated)), hashLines(skOf(golden)));
  });
  it('renderer + golden bumped together = legal system change', () => {
    const golden2 = golden + '\n<!-- skeleton v2 -->\n';
    const render2 = golden + '\n<!-- skeleton v2 -->\n';
    const r = checkImmutability({
      renderNowText: render2,
      skeletonLines: extractSkeletonLines(golden2).lines,
      goldenText: golden2,
      prevSkeletonSha: hashLines(skOf(golden)),
      prevGoldenSha: hashLines([golden]),
    });
    assert.equal(r.ok, true);
    assert.equal(r.systemChange, true);
  });
});

describe('K3: violations (red)', () => {
  it('sentinel line removed → illegal', () => {
    const broken = golden.split('\n').filter((l) => !l.includes('RELIC IS RUNNING')).join('\n');
    const r = checkImmutability({ renderNowText: broken, skeletonLines: sk, goldenText: golden, prevSkeletonSha: hashLines(skOf(golden)), prevGoldenSha: hashLines([golden]) });
    assert.equal(r.ok, false);
    assert.match(r.reason, /illegal/);
  });
  it('fixed prose reworded (rule 5) → illegal', () => {
    const broken = golden.replace('流程先读后行', '流程随便看看');
    const r = checkImmutability({ renderNowText: broken, skeletonLines: sk, goldenText: golden, prevSkeletonSha: hashLines(skOf(golden)), prevGoldenSha: hashLines([golden]) });
    assert.equal(r.ok, false);
  });
  it('renderer drift without golden bump fails A', () => {
    const drifted = renderAgentsMd(probe) + '\n## unexpected extra section\n';
    const a = assertGolden(drifted, golden);
    assert.equal(a.ok, false);
    assert.match(a.reason, /golden bump/);
  });
});
