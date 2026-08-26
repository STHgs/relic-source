// =============================================================================
// tests/workflows.test.mjs — 验证主 policies.yaml 的 workflow 渲染
// =============================================================================
// A3 验证：add-permission 和 add-workflow 两条对话式入口 workflow
// 在渲染输出（AGENTS.md）里出现，含 heading + 编号 steps。
// 这证明：用户/助手读 AGENTS.md 就能按步骤引导加规则，无需独立 skill。
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
const REPO = resolve(__dirname, '..');

const policiesYaml = readFileSync(resolve(REPO, 'policies.yaml'), 'utf8');
const policies = createValidator()(parse(policiesYaml)).doc;
const md = renderAgentsMd(policies);

describe('A3: add-permission workflow rendered', () => {
  it('contains the workflow heading', () => {
    assert.match(md, /### add-permission/);
  });
  it('contains the intent line', () => {
    assert.match(md, /Add a new permission rule via conversational interview/);
  });
  it('contains applies_when with trigger words', () => {
    assert.match(md, /trigger words/);
    assert.match(md, /加规则|add permission|\/permission/);
  });
  it('contains numbered steps including inject CLI call', () => {
    // 步骤里要提到 inject.mjs CLI 调用
    assert.match(md, /inject\.mjs --type=permission/);
    // 要有 dry-run 预览步骤
    assert.match(md, /--dry-run/);
    // 要有 --apply 步骤
    assert.match(md, /--apply/);
  });
  it('priority tag [high] present on heading', () => {
    assert.match(md, /### add-permission \[high\]/);
  });
});

describe('A3: add-workflow workflow rendered', () => {
  it('contains the workflow heading', () => {
    assert.match(md, /### add-workflow/);
  });
  it('contains the intent line', () => {
    assert.match(md, /Add a new workflow via conversational interview/);
  });
  it('contains applies_when with trigger words', () => {
    assert.match(md, /加流程|add workflow|\/workflow/);
  });
  it('contains numbered steps including inject CLI call', () => {
    assert.match(md, /inject\.mjs --type=workflow/);
  });
});

describe('A3: both workflows in 标准流程 section', () => {
  it('appear after the 标准流程 header', () => {
    const sectionStart = md.indexOf('## 标准流程');
    const addPermPos = md.indexOf('### add-permission');
    const addWfPos = md.indexOf('### add-workflow');
    assert.ok(sectionStart > -1, '标准流程 section exists');
    assert.ok(addPermPos > sectionStart, 'add-permission after section header');
    assert.ok(addWfPos > sectionStart, 'add-workflow after section header');
  });
});
