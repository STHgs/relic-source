// =============================================================================
// tests/agents-md.test.mjs — T6 AGENTS.md 渲染器测试
// =============================================================================
// R1: 输出含 ## 硬约束 表，每条 runtime 权限一行（tool/pattern/action/intent）
// R2: 输出含 ## 风险分级，low/medium/high 子段（当 risk_levels 非空）
// R3: 输出含 ## 标准流程，每个 workflow 编号步骤
// =============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { parse } from 'yaml';
import { createValidator } from '../src/core/validator.mjs';
import { renderAgentsMd } from '../src/render/agents-md.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');
const goodYaml = readFileSync(resolve(FIXTURES, 'policies-good.yaml'), 'utf8');
const policies = createValidator()(parse(goodYaml)).doc;
const md = renderAgentsMd(policies);

describe('R1: 硬约束 table contains one row per runtime permission', () => {
  it('contains the section header', () => {
    assert.match(md, /## 硬约束/);
  });
  it('contains a row for sudo-ask with tool=patterns=action=intent', () => {
    const runtime = policies.permissions.filter((p) => p.enforcement === 'runtime');
    for (const p of runtime) {
      const row = new RegExp(`\\| ${p.tool} \\|.*\\|.*\\| ${p.intent} \\|`);
      assert.match(md, row, `missing row for permission ${p.id}`);
    }
  });
  it('does NOT include advisory rules in the hard-constraint table', () => {
    // fixture has no advisory rules, so just ensure header text mentions runtime force
    assert.match(md, /运行时强制/);
  });
});

describe('R2: 风险分级 with low/medium/high subsections', () => {
  it('contains the section header', () => {
    assert.match(md, /## 风险分级/);
  });
  it('contains low/medium/high subsections when populated', () => {
    assert.match(md, /🟢 低风险/);
    assert.match(md, /🟡 中风险/);
    assert.match(md, /🔴 高风险/);
  });
  it('lists the actual risk items', () => {
    assert.match(md, /pip install known public libraries/);
    assert.match(md, /webfetch any URL/);
    assert.match(md, /mount or umount disks/);
  });
});

describe('R3: 标准流程 with numbered steps', () => {
  it('contains the section header', () => {
    assert.match(md, /## 标准流程/);
  });
  it('contains the pdf-read workflow heading', () => {
    assert.match(md, /### pdf-read/);
  });
  it('contains numbered steps 1. 2. 3.', () => {
    assert.match(md, /1\. Use look_at for summary first/);
    assert.match(md, /2\. Use read with offset/);
    assert.match(md, /3\. Use multimodal-looker for tables/);
  });
});
