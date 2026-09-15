// =============================================================================
// tests/persona.test.mjs — 工作习惯系统（L1 人设渲染 + L3 机制骨架）测试
// =============================================================================
// P1: default persona 渲染全部声明字段
// P2: 无 personas → 人设段缺席；机制段仍在（骨架无条件）
// P3: 机制骨架关键指令存在（learned.yaml 路径/上限/优先级/晋升触发/落盘判据）
// P4: 门禁交互——persona 属数据行，改 persona 不改变骨架 hash；机制段行属骨架
// =============================================================================
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { renderAgentsMd } from '../src/render/agents-md.mjs';
import { createValidator } from '../src/core/validator.mjs';
import { extractSkeletonLines, skeletonLinesOf, hashLines } from '../src/core/skeleton.mjs';

const golden = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/golden-skeleton.md'), 'utf8');
const sk = extractSkeletonLines(golden).lines;
const base = { meta: { version: 2, description: 't' }, permissions: [], workflows: [], risk_levels: { low: [], medium: [], high: [] } };
const persona = {
  id: 'default', name: '主人设', default: true,
  identity: '简洁直接的工程搭档', language: 'zh-CN',
  tone: '技术准确优先', verbosity: 'compact',
  directives: ['先结论后依据', '不用表情符号'],
};

describe('P1: default persona renders all declared fields', () => {
  const md = renderAgentsMd({ ...base, personas: [persona, { id: 'other', name: '备选' }] });
  it('renders section header + note pointing at sync repo', () => {
    assert.match(md, /## 助手人设/);
    assert.match(md, /同步库 policies\.yaml 的 personas 段/);
  });
  it('renders identity/language/tone/verbosity/directives', () => {
    assert.match(md, /定位.*简洁直接的工程搭档/);
    assert.match(md, /语言.*zh-CN/);
    assert.match(md, /基调.*技术准确优先/);
    assert.match(md, /详细度.*compact/);
    assert.match(md, /先结论后依据/);
  });
  it('non-default persona content NOT rendered', () => {
    assert.ok(!md.includes('备选'));
  });
  it('persona passes schema v2', () => {
    const v = createValidator()({ ...base, personas: [persona] });
    assert.equal(v.ok, true, (v.errors || []).join('; '));
  });
});

describe('P2: empty personas → section absent, mechanism remains', () => {
  const md = renderAgentsMd(base);
  it('no persona section when personas empty', () => {
    assert.ok(!md.includes('## 助手人设'));
  });
  it('mechanism section is unconditional skeleton', () => {
    assert.match(md, /## 学习与适应（每轮生效）/);
  });
});

describe('P3: mechanism skeleton directives', () => {
  const md = renderAgentsMd(base);
  it('names the learned store path', () => assert.match(md, /~\/\.config\/relic-habits\/learned\.yaml/));
  it('caps entries and bytes', () => {
    assert.match(md, /上限 50 条/);
    assert.match(md, /25KB/);
  });
  it('states priority order', () => assert.match(md, /助手人设（声明层）> 本 session 新学习 > 历史学习条目/));
  it('promotion is explicit-trigger only', () => assert.match(md, /记住 \/ 固化/));
  it('write gate skips declared/derivable', () => assert.match(md, /未覆盖.*无法从环境/));
  it('entry typing', () => assert.match(md, /style\|feedback\|workflow\|reference/));
});

describe('P4: gate interaction — persona is data, mechanism is skeleton', () => {
  it('changing persona content does not change skeleton hash', () => {
    const h1 = hashLines(skeletonLinesOf(renderAgentsMd({ ...base, personas: [persona] }), sk));
    const h2 = hashLines(skeletonLinesOf(renderAgentsMd({ ...base, personas: [{ ...persona, tone: '完全不同的基调', directives: ['全新指令'] }] }), sk));
    assert.equal(h1, h2);
  });
  it('mechanism lines are locked in golden (skeleton set)', () => {
    assert.ok(sk.some((l) => l.includes('学习与适应')));
    assert.ok(sk.some((l) => l.includes('relic-habits/learned.yaml')));
  });
});
