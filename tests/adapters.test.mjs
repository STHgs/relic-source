// =============================================================================
// tests/adapters.test.mjs — T8 三适配器测试
// =============================================================================
// A1: opencode FileMap keys = { opencode.agent.jsonc, AGENTS.md }
// A2: omo FileMap keys = { omo.permission.jsonc }；resolveAgents 角色→agent 名
// A3: opencode role-flattening——所有 runtime 权限在 general/build/explore 三 agent
//     下出现且 permission map 一致
// A4: claude FileMap keys = { AGENTS.md } only — NO claude.hooks.json（F1=DROP 验证）
// A5: round-trip 稳定——generate(parse(stringify(generate(p)))) 字节一致
// =============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { parse, stringify } from 'yaml';
import { createValidator } from '../src/core/validator.mjs';
import opencodeAdapter from '../src/adapters/opencode.mjs';
import omoAdapter, { resolveAgents } from '../src/adapters/omo.mjs';
import claudeAdapter from '../src/adapters/claude.mjs';
import dshAdapter from '../src/adapters/dsh.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');
const goodYaml = readFileSync(resolve(FIXTURES, 'policies-good.yaml'), 'utf8');
const policies = createValidator()(parse(goodYaml)).doc;

const fakeEnv = (paths, home = '/fake') => ({ home, existsSync: (p) => paths.has(p) });

describe('A1: opencode FileMap keys', () => {
  const fm = opencodeAdapter.generate(policies, fakeEnv(new Set()));
  it('has opencode.agent.jsonc and AGENTS.md', () => {
    assert.deepEqual(Object.keys(fm).sort(), ['AGENTS.md', 'opencode.agent.jsonc']);
  });
  it('opencode.agent.jsonc has general/build/explore', () => {
    const obj = JSON.parse(fm['opencode.agent.jsonc']);
    assert.deepEqual(Object.keys(obj).sort(), ['build', 'explore', 'general']);
  });
});

describe('A2: omo FileMap keys + resolveAgents', () => {
  const fm = omoAdapter.generate(policies, fakeEnv(new Set()));
  it('has only omo.permission.jsonc', () => {
    assert.deepEqual(Object.keys(fm), ['omo.permission.jsonc']);
  });
  it('resolveAgents([primary,deep]) = [sisyphus, hephaestus]', () => {
    const r = resolveAgents(['primary', 'deep']);
    assert.deepEqual(r.sort(), ['hephaestus', 'sisyphus']);
  });
  it('resolveAgents([all]) = all 4 agents', () => {
    const r = resolveAgents(['all']);
    assert.equal(r.length, 4);
    assert.ok(r.includes('sisyphus'));
    assert.ok(r.includes('hephaestus'));
    assert.ok(r.includes('sisyphus-junior'));
    assert.ok(r.includes('atlas'));
  });
});

describe('A3: opencode role-flattening', () => {
  const fm = opencodeAdapter.generate(policies, fakeEnv(new Set()));
  const obj = JSON.parse(fm['opencode.agent.jsonc']);
  it('ALL runtime perms appear under general AND build AND explore (identical maps)', () => {
    // 取三个 agent 的 permission 字段，必须严格相等
    const g = JSON.stringify(obj.general.permission);
    const b = JSON.stringify(obj.build.permission);
    const e = JSON.stringify(obj.explore.permission);
    assert.equal(g, b, 'general != build');
    assert.equal(b, e, 'build != explore');
  });
  it('sudo-ask rule present in general.permission.bash', () => {
    assert.ok(obj.general.permission.bash, 'bash key missing');
  });
});

describe('A4: claude FileMap has ONLY AGENTS.md (F1 = DROP)', () => {
  const fm = claudeAdapter.generate(policies, fakeEnv(new Set()));
  it('keys = [AGENTS.md] only', () => {
    assert.deepEqual(Object.keys(fm), ['AGENTS.md']);
  });
  it('NO claude.hooks.json key present', () => {
    assert.equal(fm['claude.hooks.json'], undefined);
  });
  it('AGENTS.md content has 硬约束 section', () => {
    assert.match(fm['AGENTS.md'], /## 硬约束/);
  });
});

describe('A5: round-trip stability', () => {
  const fm1 = opencodeAdapter.generate(policies, fakeEnv(new Set()));
  const fm2 = opencodeAdapter.generate(
    parse(stringify(policies)),
    fakeEnv(new Set())
  );
  it('opencode FileMap byte-identical after stringify→parse round-trip', () => {
    assert.equal(fm1['opencode.agent.jsonc'], fm2['opencode.agent.jsonc']);
    assert.equal(fm1['AGENTS.md'], fm2['AGENTS.md']);
  });

  const fmOmo1 = omoAdapter.generate(policies, fakeEnv(new Set()));
  const fmOmo2 = omoAdapter.generate(parse(stringify(policies)), fakeEnv(new Set()));
  it('omo FileMap byte-identical after round-trip', () => {
    assert.equal(fmOmo1['omo.permission.jsonc'], fmOmo2['omo.permission.jsonc']);
  });

  const fmCl1 = claudeAdapter.generate(policies, fakeEnv(new Set()));
  const fmCl2 = claudeAdapter.generate(parse(stringify(policies)), fakeEnv(new Set()));
  it('claude FileMap byte-identical after round-trip', () => {
    assert.equal(fmCl1['AGENTS.md'], fmCl2['AGENTS.md']);
  });
});

describe('adapter.detect()', () => {
  it('opencode detects when config present', () => {
    const home = '/fake';
    const env = fakeEnv(new Set([join(home, '.config', 'opencode', 'opencode.jsonc')]), home);
    assert.equal(opencodeAdapter.detect(env), true);
  });
  it('opencode does not detect when absent', () => {
    assert.equal(opencodeAdapter.detect(fakeEnv(new Set())), false);
  });
  it('omo detects when ~/.omo/omo.jsonc present', () => {
    const home = '/fake';
    const env = fakeEnv(new Set([join(home, '.omo', 'omo.jsonc')]), home);
    assert.equal(omoAdapter.detect(env), true);
  });
  it('claude detects when ~/.claude dir present', () => {
    const home = '/fake';
    const env = fakeEnv(new Set([join(home, '.claude')]), home);
    assert.equal(claudeAdapter.detect(env), true);
  });
});

describe('adapter.install() dryRun', () => {
  const home = '/nonexistent-dry-run-path';
  it('opencode dryRun returns skipped, no written, no errors', () => {
    const r = opencodeAdapter.install(
      { 'opencode.agent.jsonc': '{}', 'AGENTS.md': '# x' },
      { home, dryRun: true }
    );
    assert.equal(r.written.length, 0);
    assert.equal(r.errors.length, 0);
    assert.ok(r.skipped.length > 0);
  });
  it('omo dryRun returns skipped', () => {
    const r = omoAdapter.install(
      { 'omo.permission.jsonc': '{}' },
      { home, dryRun: true }
    );
    assert.equal(r.written.length, 0);
    assert.ok(r.skipped.length > 0);
  });
  it('claude dryRun returns skipped', () => {
    const r = claudeAdapter.install(
      { 'AGENTS.md': '# x' },
      { home, dryRun: true }
    );
    assert.equal(r.written.length, 0);
    assert.ok(r.skipped.length > 0);
  });
});

describe('A6: dsh FileMap keys', () => {
  const fm = dshAdapter.generate(policies, fakeEnv(new Set()));
  it('keys = [AGENTS.md] only', () => {
    assert.deepEqual(Object.keys(fm), ['AGENTS.md']);
  });
  it('AGENTS.md content has 硬约束 section', () => {
    assert.match(fm['AGENTS.md'], /## 硬约束/);
  });
});

describe('A6b: dsh round-trip stability', () => {
  const fm1 = dshAdapter.generate(policies, fakeEnv(new Set()));
  const fm2 = dshAdapter.generate(parse(stringify(policies)), fakeEnv(new Set()));
  it('dsh FileMap byte-identical after stringify→parse round-trip', () => {
    assert.equal(fm1['AGENTS.md'], fm2['AGENTS.md']);
  });
});

describe('A6c: dsh adapter.detect()', () => {
  it('dsh detects when ~/.dsh dir present', () => {
    const home = '/fake';
    const env = fakeEnv(new Set([join(home, '.dsh')]), home);
    assert.equal(dshAdapter.detect(env), true);
  });
  it('dsh does not detect when absent', () => {
    assert.equal(dshAdapter.detect(fakeEnv(new Set())), false);
  });
});

describe('A6d: dsh adapter.install() dryRun', () => {
  const home = '/nonexistent-dry-run-path';
  it('dsh dryRun returns skipped, no written, no errors', () => {
    const r = dshAdapter.install(
      { 'AGENTS.md': '# x' },
      { home, dryRun: true }
    );
    assert.equal(r.written.length, 0);
    assert.equal(r.errors.length, 0);
    assert.ok(r.skipped.length > 0);
  });
  it('dsh dryRun skips when no AGENTS.md in map', () => {
    const r = dshAdapter.install({}, { home, dryRun: true });
    assert.equal(r.written.length, 0);
    assert.ok(r.skipped.length > 0);
  });
});
