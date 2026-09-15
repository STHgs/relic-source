// =============================================================================
// src/core/skeleton.mjs — 静态骨架门禁（计划 v6：骨架等价检查）
// =============================================================================
// 原则（用户拍板 2026-09-14）：
//   1. 骨架是静态的：骨架 = 渲染器的唯一函数，与用户内容（modules/policies）无关
//   2. 用户区提交触碰骨架 = 违法
//   3. 骨架变更唯一合法路径：renderer + golden 基准同一提交更新（系统级变更）
//
// 机制：
//   - 探针策略（schema 合法、每个数据槽位放 PROBE_MARK 项）→ render → golden 基准
//   - skeletonLines = golden 行 − 探针行 − 结构噪声行（空行/分隔线/表分隔行）
//   - 断言 A（等价）：render(探针) == golden（字节级）——拦"改 renderer 不 bump golden"
//   - 断言 B（不变）：两次 render 的骨架行序列 hash 一致，除非 golden 同步变更
// =============================================================================

import { createHash } from 'crypto';

/** 探针标记：出现在任何数据行中；golden 抽取时被过滤。 */
export const PROBE_MARK = '«skeleton-probe»';

/**
 * 构造探针最小策略：激活渲染器全部骨架分支（含条件段：风险分级/替代方案/索引表/Profile 头）。
 * @returns {object} schema v2 合法的 policies 对象
 */
export function buildProbePolicies() {
  return {
    meta: {
      version: 2,
      description: 'skeleton probe policies (golden render source)',
      evaluation: PROBE_MARK,
      profile: { id: 'probe', name: 'Probe' },
    },
    permissions: [{
      id: 'probe-perm',
      intent: `${PROBE_MARK} probe permission intent`,
      applies_to: ['all'],
      enforcement: 'runtime',
      tool: 'bash',
      action: 'ask',
      patterns: [{ pattern: 'probecmd *', action: 'ask' }],
      alternatives: [PROBE_MARK],
    }],
    workflows: [{
      id: 'probe-wf',
      intent: `${PROBE_MARK} probe workflow`,
      applies_when: PROBE_MARK,
      priority: 'normal',
      steps: [PROBE_MARK],
    }],
    risk_levels: { low: [PROBE_MARK], medium: [PROBE_MARK], high: [PROBE_MARK] },
    personas: [{
      id: 'probe-persona',
      name: PROBE_MARK,
      default: true,
      identity: PROBE_MARK,
      language: PROBE_MARK,
      tone: PROBE_MARK,
      verbosity: 'compact',
      directives: [PROBE_MARK],
    }],
    modules: [],
    profiles: [],
  };
}

/** 结构噪声行：空行、水平分隔线、markdown 表分隔行（多表重复，无法唯一归属骨架）。 */
function isStructuralNoise(line) {
  const t = line.trim();
  // '````' 是哨兵外层围栏对（开/闭各一次，纯标点，与 '---' 同类）
  return t === '' || t === '---' || t === '````' || /^\|(?:-+\|)+$/.test(t);
}

/**
 * 从 golden 文本抽取骨架行集（保序、去探针、去结构噪声）。
 * @param {string} goldenText
 * @returns {{lines: string[], unique: boolean}}
 */
export function extractSkeletonLines(goldenText) {
  const lines = goldenText.split('\n')
    .filter((l) => !l.includes(PROBE_MARK) && !isStructuralNoise(l));
  const seen = new Set();
  let unique = true;
  for (const l of lines) {
    if (seen.has(l)) unique = false;
    seen.add(l);
  }
  return { lines, unique };
}

/**
 * 从任意 render 产出中取出骨架行序列（按 skeletonLines 集合过滤，保序）。
 * @param {string} renderText
 * @param {string[]} skeletonLines golden 抽取出的骨架行集
 * @returns {string[]}
 */
export function skeletonLinesOf(renderText, skeletonLines) {
  const set = new Set(skeletonLines);
  return renderText.split('\n').filter((l) => set.has(l));
}

/** sha256(lines.join('\n')) */
export function hashLines(lines) {
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

/**
 * 断言 A：探针渲染与 golden 字节等价。
 * @returns {{ok:boolean, reason?:string}}
 */
export function assertGolden(probeRender, goldenText) {
  if (probeRender === goldenText) return { ok: true };
  return { ok: false, reason: 'skeleton drift: render(probe) !== golden (renderer changed without golden bump — illegal system change)' };
}

/**
 * 断言 B：骨架不变性。骨架 hash 变了 且 golden 没变 → 违法。
 * @param {object} p
 * @param {string} p.renderNowText    当前真实策略的 render
 * @param {string[]} p.skeletonLines  golden 抽取的骨架行集
 * @param {string} p.goldenText       当前 golden 全文
 * @param {string|null} p.prevSkeletonSha 上次部署记录的骨架 hash（null=首次，放行）
 * @param {string|null} p.prevGoldenSha   上次部署记录的 golden hash
 * @returns {{ok:boolean, reason?:string, skeletonSha:string, goldenSha:string, systemChange?:boolean}}
 */
export function checkImmutability(p) {
  const skeletonSha = hashLines(skeletonLinesOf(p.renderNowText, p.skeletonLines));
  const goldenSha = hashLines([p.goldenText]);
  if (p.prevSkeletonSha == null) {
    return { ok: true, skeletonSha, goldenSha, systemChange: false };
  }
  if (skeletonSha === p.prevSkeletonSha) {
    return { ok: true, skeletonSha, goldenSha, systemChange: false };
  }
  if (p.prevGoldenSha != null && goldenSha !== p.prevGoldenSha) {
    return { ok: true, skeletonSha, goldenSha, systemChange: true };
  }
  return {
    ok: false,
    skeletonSha,
    goldenSha,
    reason: 'skeleton lines changed while golden fixture unchanged (user-zone commit touching skeleton — illegal)',
  };
}
