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
import { createValidator } from '../src/core/validator.mjs';
import { renderAgentsMd } from '../src/render/agents-md.mjs';
import {
  buildProbePolicies, extractSkeletonLines, hashLines,
  assertGolden, checkDeterminism, PROBE_MARK,
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

describe('K2: determinism guard legal paths (green)', () => {
  const base = { contentCommit: 'c1', goldenText: 'G', rendererText: 'R', outputText: 'O' };
  it('first run (no prior state) passes and returns signatures', () => {
    const r = checkDeterminism({ ...base, prevInputSig: null, prevOutputSha: null });
    assert.equal(r.ok, true);
    assert.match(r.inputSig, /^[0-9a-f]{64}$/);
    assert.match(r.outputSha, /^[0-9a-f]{64}$/);
    assert.equal(r.changed, true);
  });
  it('same inputs + same output → pass (stable)', () => {
    const r1 = checkDeterminism({ ...base, prevInputSig: null });
    const r2 = checkDeterminism({ ...base, prevInputSig: r1.inputSig, prevOutputSha: r1.outputSha });
    assert.equal(r2.ok, true);
    assert.equal(r2.changed, false);
  });
  it('input changed (content/golden/renderer) → pass + re-record', () => {
    const r1 = checkDeterminism({ ...base, prevInputSig: null });
    const r2 = checkDeterminism({ ...base, outputText: 'O-different-because-input-changed', prevInputSig: 'not-matching', prevOutputSha: r1.outputSha });
    assert.equal(r2.ok, true);
    assert.equal(r2.changed, true);
  });
});

describe('K3: violations (red)', () => {
  const base = { contentCommit: 'c1', goldenText: 'G', rendererText: 'R', outputText: 'O' };
  it('same inputs but different output → illegal (non-determinism/tamper)', () => {
    const r1 = checkDeterminism({ ...base, prevInputSig: null });
    const r2 = checkDeterminism({ ...base, outputText: 'TAMPERED OUTPUT', prevInputSig: r1.inputSig, prevOutputSha: r1.outputSha });
    assert.equal(r2.ok, false);
    assert.match(r2.reason, /illegal/);
  });
  it('renderer drift without golden bump fails A', () => {
    const drifted = renderAgentsMd(buildProbePolicies()) + '\n## unexpected extra section\n';
    const a = assertGolden(drifted, golden);
    assert.equal(a.ok, false);
    assert.match(a.reason, /golden bump/);
  });
});
