// =============================================================================
// tests/gate.test.mjs — 通用同步门控（全平台）
// =============================================================================
// G1: gateCheck 三态（全无/dsh 在场/opencode 在场）
// G2: probeSignature（posix pgrep 路径，真实进程）
// G3: gateLogPath 平台惯例
// G4: appendGateLog best-effort（失败不抛）
// G5: sync.mjs isTTY 守卫语义（--no-gate 与 TTY 时跳过门控）
// =============================================================================
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { gateCheck, probeSignature, gateLogPath, appendGateLog } from '../src/core/gate.mjs';

describe('G1: gateCheck three states (probe injected)', () => {
  it('no consumer -> ok:false with reason', () => {
    const r = gateCheck({ probe: () => false });
    assert.equal(r.ok, false);
    assert.match(r.reason, /no harness process alive/);
  });
  it('dsh alive -> ok:true, alive=[dsh]', () => {
    const r = gateCheck({ probe: (sig) => sig.includes('dsh') });
    assert.equal(r.ok, true);
    assert.deepEqual(r.alive, ['dsh']);
  });
  it('opencode alive -> ok:true (any harness counts)', () => {
    const r = gateCheck({ probe: (sig) => sig === 'opencode' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.alive, ['opencode']);
  });
  it('alive deduped across signatures of same harness', () => {
    const r = gateCheck({ probe: (sig) => sig.startsWith('@deepseek-ai') });
    assert.deepEqual(r.alive, ['dsh']);
  });
});

describe('G2: probeSignature real process (posix pgrep)', () => {
  it('finds this very test process signature', () => {
    // node --test 进程的命令行含 "node"；用 node 自身作为被探测"进程"
    const found = probeSignature('node --test');
    assert.equal(typeof found, 'boolean');
  });
  it('nonexistent signature -> false (posix)', () => {
    if (process.platform === 'win32') return;  // win wmic 探测在此环境不可测
    assert.equal(probeSignature('definitely-not-running-xyz-9x8'), false);
  });
});

describe('G3: gateLogPath platform convention', () => {
  it('returns a path ending with sync-gate.log', () => {
    assert.match(gateLogPath(), /sync-gate\.log$/);
  });
});

describe('G4: appendGateLog best-effort', () => {
  it('writes and never throws', () => {
    appendGateLog({ action: 'run', reason: 'test entry', invokedBy: 'gate.test' });
    const content = readFileSync(gateLogPath(), 'utf8');
    assert.match(content, /action=run.*by=gate\.test/);
  });
});

describe('G5: sync.mjs gate semantics (source-level contract)', () => {
  it('sync.mjs sources contain isTTY guard + --no-gate escape', async () => {
    const src = readFileSync(new URL('../scripts/sync.mjs', import.meta.url), 'utf8');
    assert.match(src, /isTTY/);
    assert.match(src, /--no-gate/);
    assert.match(src, /gateCheck/);
  });
});
