// =============================================================================
// tests/adapters-merge.test.mjs — P1+P2: install deep/shallow merge (GAP1+GAP2)
// =============================================================================
// P1 (GAP1): omo install must deep-merge permission into existing
//   omo.jsonc['[opencode]'].agents.<name>.permission, preserving
//   model/fallback_models/other top-level + per-agent fields.
//   Faithful port of live install.sh:87-94 merge semantics.
//
// P2 (GAP2): opencode install must shallow-merge agent field into existing
//   opencode.jsonc, preserving provider/model/sharing top-level sentinels.
//   Faithful port of live install.sh:146 merge semantics.
//   Q6 decision: match live shallow merge exactly (oc.agent = {...(oc.agent||{}), ...genAgent}).
//
// Also tests stripJsonc/parseJsonc shared helpers (extracted from live install.sh).
// =============================================================================

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, symlinkSync, lstatSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { stripJsonc, parseJsonc } from '../src/adapters/base.mjs';
import omoAdapter from '../src/adapters/omo.mjs';
import opencodeAdapter from '../src/adapters/opencode.mjs';

let scratch;
beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'relic-merge-'));
});
afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

// ─── stripJsonc / parseJsonc ──────────────────────────────────────────

describe('stripJsonc()', () => {
  it('strips single-line comments (//)', () => {
    const input = '{ "a": 1 // comment\n, "b": 2 }';
    const out = stripJsonc(input);
    assert.equal(out, '{ "a": 1 \n, "b": 2 }');
  });

  it('strips block comments (/* */)', () => {
    const input = '{ "a": /* inline */ 1 }';
    const out = stripJsonc(input);
    assert.equal(out, '{ "a":  1 }');
  });

  it('preserves // inside strings', () => {
    const input = '{ "url": "https://example.com" }';
    const out = stripJsonc(input);
    assert.equal(out, input);
  });

  it('preserves /* inside strings', () => {
    const input = '{ "path": "a/*b" }';
    const out = stripJsonc(input);
    assert.equal(out, input);
  });

  it('handles escaped backslash-quote in strings', () => {
    const input = '{ "s": "a\\"//b" }';
    const out = stripJsonc(input);
    assert.equal(out, input);
  });

  it('handles multi-line block comments', () => {
    const input = '{ "a": /* multi\nline\ncomment */ 1 }';
    const out = stripJsonc(input);
    assert.equal(out, '{ "a":  1 }');
  });

  it('handles empty string', () => {
    assert.equal(stripJsonc(''), '');
  });

  it('handles string with no comments unchanged', () => {
    const input = '{"x":1,"y":2}';
    assert.equal(stripJsonc(input), input);
  });
});

describe('parseJsonc()', () => {
  it('parses JSONC with comments', () => {
    const input = '// header\n{ "a": 1 /* x */, "b": 2 }';
    const obj = parseJsonc(input);
    assert.deepEqual(obj, { a: 1, b: 2 });
  });

  it('parses plain JSON', () => {
    assert.deepEqual(parseJsonc('{"x":1}'), { x: 1 });
  });
});

// ─── P1: omo install deep-merge (GAP1) ─────────────────────────────────

describe('P1: omo install deep-merge (GAP1)', () => {
  // Build a fake generated omo.permission.jsonc (flat shape, as generate() emits)
  const genPerm = {
    sisyphus: {
      permission: {
        bash: { 'sudo *': 'ask', 'rm -rf /*': 'deny' },
      },
    },
    hephaestus: {
      permission: {
        bash: { 'sudo *': 'ask' },
      },
    },
  };
  const fileMap = { 'omo.permission.jsonc': JSON.stringify(genPerm, null, 2) + '\n' };

  it('preserves model + fallback_models on existing agent', () => {
    // Seed omo.jsonc with sentinels that must survive install
    const omoDir = join(scratch, '.omo');
    mkdirSync(omoDir, { recursive: true });
    const omoPath = join(omoDir, 'omo.jsonc');
    writeFileSync(
      omoPath,
      [
        '// user header comment',
        '{',
        '  "[opencode]": {',
        '    "agents": {',
        '      "sisyphus": {',
        '        "model": "glm-5.2",',
        '        "fallback_models": ["gpt-4", "claude-3"],',
        '        "permission": { "bash": { "old-rule": "allow" }, "webfetch": "ask" }',
        '      }',
        '    }',
        '  },',
        '  "other_key": 42',
        '}',
      ].join('\n')
    );

    const report = omoAdapter.install(fileMap, { home: scratch });
    assert.equal(report.ok, true, `install should succeed: ${report.errors.join('; ')}`);
    assert.equal(report.written.length, 1);

    const written = parseJsonc(readFileSync(omoPath, 'utf8'));

    // Sentinel: model survives
    assert.equal(written['[opencode]'].agents.sisyphus.model, 'glm-5.2');
    // Sentinel: fallback_models survives
    assert.deepEqual(written['[opencode]'].agents.sisyphus.fallback_models, ['gpt-4', 'claude-3']);
    // Sentinel: other_key survives
    assert.equal(written.other_key, 42);
    // Merge (shallow at permission level, faithful to install.sh:94):
    //   different tool keys preserved, same tool key replaced entirely by gen.
    assert.equal(written['[opencode]'].agents.sisyphus.permission.webfetch, 'ask');
    // bash key entirely replaced by gen's bash (old-rule lost — faithful to live)
    assert.equal(written['[opencode]'].agents.sisyphus.permission.bash['old-rule'], undefined);
    assert.equal(written['[opencode]'].agents.sisyphus.permission.bash['sudo *'], 'ask');
    assert.equal(written['[opencode]'].agents.sisyphus.permission.bash['rm -rf /*'], 'deny');
  });

  it('creates [opencode].agents structure when absent', () => {
    const omoDir = join(scratch, '.omo');
    mkdirSync(omoDir, { recursive: true });
    const omoPath = join(omoDir, 'omo.jsonc');
    writeFileSync(omoPath, '{ "unrelated": true }');

    omoAdapter.install(fileMap, { home: scratch });

    const written = parseJsonc(readFileSync(omoPath, 'utf8'));
    assert.equal(written.unrelated, true); // preserved
    assert.ok(written['[opencode]'], '[opencode] created');
    assert.ok(written['[opencode]'].agents.sisyphus, 'agent created');
    assert.equal(written['[opencode]'].agents.sisyphus.permission.bash['sudo *'], 'ask');
  });

  it('creates new agent entry when agent absent but [opencode].agents exists', () => {
    const omoDir = join(scratch, '.omo');
    mkdirSync(omoDir, { recursive: true });
    const omoPath = join(omoDir, 'omo.jsonc');
    writeFileSync(
      omoPath,
      JSON.stringify(
        { '[opencode]': { agents: { existingAgent: { model: 'x' } } } },
        null, 2
      )
    );

    omoAdapter.install(fileMap, { home: scratch });

    const written = parseJsonc(readFileSync(omoPath, 'utf8'));
    // Existing agent untouched
    assert.equal(written['[opencode]'].agents.existingAgent.model, 'x');
    // New agent created
    assert.ok(written['[opencode]'].agents.sisyphus);
    assert.equal(written['[opencode]'].agents.sisyphus.permission.bash['sudo *'], 'ask');
  });

  it('new permission keys override same-name existing keys (gen wins)', () => {
    const omoDir = join(scratch, '.omo');
    mkdirSync(omoDir, { recursive: true });
    const omoPath = join(omoDir, 'omo.jsonc');
    writeFileSync(
      omoPath,
      JSON.stringify(
        {
          '[opencode]': {
            agents: {
              sisyphus: {
                permission: { bash: { 'sudo *': 'allow' } }, // old value
              },
            },
          },
        },
        null, 2
      )
    );

    omoAdapter.install(fileMap, { home: scratch });

    const written = parseJsonc(readFileSync(omoPath, 'utf8'));
    // Gen value 'ask' overrides old 'allow'
    assert.equal(written['[opencode]'].agents.sisyphus.permission.bash['sudo *'], 'ask');
  });

  it('creates backup before writing', () => {
    const omoDir = join(scratch, '.omo');
    mkdirSync(omoDir, { recursive: true });
    const omoPath = join(omoDir, 'omo.jsonc');
    const oldContent = '{ "old": true }';
    writeFileSync(omoPath, oldContent);

    const report = omoAdapter.install(fileMap, { home: scratch });
    assert.equal(report.backups.length, 1);
    assert.equal(readFileSync(report.backups[0], 'utf8'), oldContent);
  });

  it('handles jsonc with comments in existing config', () => {
    const omoDir = join(scratch, '.omo');
    mkdirSync(omoDir, { recursive: true });
    const omoPath = join(omoDir, 'omo.jsonc');
    writeFileSync(
      omoPath,
      [
        '// my omo config',
        '{',
        '  "[opencode]": { /* opencode section */',
        '    "agents": {',
        '      "sisyphus": { "model": "glm-5.2", "permission": {} }',
        '      // hephaestus configured elsewhere',
        '    }',
        '  }',
        '}',
      ].join('\n')
    );

    const report = omoAdapter.install(fileMap, { home: scratch });
    assert.equal(report.ok, true, `should handle jsonc: ${report.errors.join('; ')}`);

    const written = parseJsonc(readFileSync(omoPath, 'utf8'));
    assert.equal(written['[opencode]'].agents.sisyphus.model, 'glm-5.2');
    assert.equal(written['[opencode]'].agents.sisyphus.permission.bash['sudo *'], 'ask');
  });
});

// ─── P2: opencode install shallow-merge (GAP2) ─────────────────────────

describe('P2: opencode install shallow-merge (GAP2)', () => {
  // Build a fake generated opencode.agent.jsonc (as generate() emits)
  const genAgent = {
    general: { mode: 'primary', permission: { bash: { 'sudo *': 'ask' } } },
    build: { mode: 'subagent', permission: { bash: { 'sudo *': 'ask' } } },
    explore: { mode: 'subagent', permission: { bash: { 'sudo *': 'ask' } } },
  };
  const fileMap = {
    'opencode.agent.jsonc': JSON.stringify(genAgent, null, 2) + '\n',
    'AGENTS.md': '# AGENTS.md\n',
  };

  it('preserves provider/model/sharing top-level sentinels', () => {
    const ocDir = join(scratch, '.config', 'opencode');
    mkdirSync(ocDir, { recursive: true });
    const ocPath = join(ocDir, 'opencode.jsonc');
    writeFileSync(
      ocPath,
      [
        '// user opencode config',
        '{',
        '  "provider": { "name": "openai", "key": "sk-xxx" },',
        '  "model": "gpt-4o",',
        '  "sharing": { "enabled": true, "endpoint": "http://x" },',
        '  "agent": {',
        '    "myCustomAgent": { "mode": "primary" }',
        '  }',
        '}',
      ].join('\n')
    );

    const report = opencodeAdapter.install(fileMap, { home: scratch });
    assert.equal(report.ok, true, `install should succeed: ${report.errors.join('; ')}`);

    const written = parseJsonc(readFileSync(ocPath, 'utf8'));

    // Sentinels survive
    assert.deepEqual(written.provider, { name: 'openai', key: 'sk-xxx' });
    assert.equal(written.model, 'gpt-4o');
    assert.deepEqual(written.sharing, { enabled: true, endpoint: 'http://x' });
    // Non-governance agent preserved (shallow merge: other agents kept)
    assert.ok(written.agent.myCustomAgent, 'custom agent preserved');
    assert.equal(written.agent.myCustomAgent.mode, 'primary');
    // Governance agents injected
    assert.ok(written.agent.general);
    assert.equal(written.agent.general.permission.bash['sudo *'], 'ask');
    assert.ok(written.agent.build);
    assert.ok(written.agent.explore);
  });

  it('creates agent field when absent', () => {
    const ocDir = join(scratch, '.config', 'opencode');
    mkdirSync(ocDir, { recursive: true });
    const ocPath = join(ocDir, 'opencode.jsonc');
    writeFileSync(ocPath, '{ "model": "x" }');

    opencodeAdapter.install(fileMap, { home: scratch });

    const written = parseJsonc(readFileSync(ocPath, 'utf8'));
    assert.equal(written.model, 'x'); // preserved
    assert.ok(written.agent, 'agent field created');
    assert.ok(written.agent.general);
  });

  it('gen agents replace existing same-name agents (shallow merge semantics)', () => {
    const ocDir = join(scratch, '.config', 'opencode');
    mkdirSync(ocDir, { recursive: true });
    const ocPath = join(ocDir, 'opencode.jsonc');
    writeFileSync(
      ocPath,
      JSON.stringify(
        {
          model: 'm',
          agent: {
            general: { mode: 'diff', customField: 'keepme' }, // will be replaced
            otherAgent: { mode: 'primary' }, // will survive
          },
        },
        null, 2
      )
    );

    opencodeAdapter.install(fileMap, { home: scratch });

    const written = parseJsonc(readFileSync(ocPath, 'utf8'));
    // Q6 = shallow merge: general replaced entirely by gen (customField lost)
    assert.equal(written.agent.general.mode, 'primary'); // gen's mode
    assert.equal(written.agent.general.customField, undefined); // lost — faithful to live
    // Other agent preserved
    assert.equal(written.agent.otherAgent.mode, 'primary');
  });

  it('handles jsonc with comments in existing config', () => {
    const ocDir = join(scratch, '.config', 'opencode');
    mkdirSync(ocDir, { recursive: true });
    const ocPath = join(ocDir, 'opencode.jsonc');
    writeFileSync(
      ocPath,
      [
        '// my config',
        '{',
        '  "provider": { "name": "x" }, /* provider */',
        '  "model": "gpt-4o"',
        '}',
      ].join('\n')
    );

    const report = opencodeAdapter.install(fileMap, { home: scratch });
    assert.equal(report.ok, true, `should handle jsonc: ${report.errors.join('; ')}`);

    const written = parseJsonc(readFileSync(ocPath, 'utf8'));
    assert.deepEqual(written.provider, { name: 'x' });
    assert.equal(written.model, 'gpt-4o');
  });

  it('creates backup before writing', () => {
    const ocDir = join(scratch, '.config', 'opencode');
    mkdirSync(ocDir, { recursive: true });
    const ocPath = join(ocDir, 'opencode.jsonc');
    const oldContent = '{ "old": true }';
    writeFileSync(ocPath, oldContent);

    const report = opencodeAdapter.install(fileMap, { home: scratch });
    assert.equal(report.backups.length, 1);
    assert.equal(readFileSync(report.backups[0], 'utf8'), oldContent);
  });

  it('AGENTS.md still written (no regression)', () => {
    const ocDir = join(scratch, '.config', 'opencode');
    mkdirSync(ocDir, { recursive: true });
    const agentsMdPath = join(ocDir, 'AGENTS.md');

    opencodeAdapter.install(fileMap, { home: scratch });

    assert.ok(readFileSync(agentsMdPath, 'utf8').includes('AGENTS.md'));
  });

  it('replaces symlinked AGENTS.md with regular file (cutover blocker fix)', () => {
    const ocDir = join(scratch, '.config', 'opencode');
    mkdirSync(ocDir, { recursive: true });
    const agentsMdPath = join(ocDir, 'AGENTS.md');
    const targetPath = join(ocDir, 'generated-AGENTS.md');
    writeFileSync(targetPath, '# OLD CACHE\n');
    // Create symlink: AGENTS.md -> generated-AGENTS.md (like live install.sh:169)
    symlinkSync(targetPath, agentsMdPath);

    opencodeAdapter.install(fileMap, { home: scratch });

    // Must be a regular file now, not a symlink
    assert.equal(lstatSync(agentsMdPath).isSymbolicLink(), false, 'AGENTS.md must not be a symlink after install');
    // Content must be the new generated content, not the old cache
    assert.ok(readFileSync(agentsMdPath, 'utf8').includes('AGENTS.md'));
    // The old cache target must be untouched (writeFileSync would have corrupted it)
    assert.equal(readFileSync(targetPath, 'utf8'), '# OLD CACHE\n');
  });
});
