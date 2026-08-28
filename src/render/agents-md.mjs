// =============================================================================
// src/render/agents-md.mjs — AGENTS.md 渲染器（从前身 buildAgentsMd 端口）
// =============================================================================
// 输入：policies 对象（schema v2 形状，含默认值）
// 输出：AGENTS.md 文本字符串
//
// 与前身的关系：纯端口，语义不变——
//   - 硬约束表（runtime 权限）
//   - 替代方案（有 alternatives 的规则）
//   - 风险分级（low/medium/high）
//   - 标准流程（workflows）
//   - 给助手的话（固定收尾）
//
// 差异（relic 重写）：
//   - 纯函数，不写盘（写盘是适配器 install 的事）——便于测试、便于多平台复用
//   - 不带生成时间戳（前身每次 new Date() 导致 round-trip 不稳；时间戳由 writeWithHeader 在写盘层加）
//   - 不带"源文件路径"硬编码（relic 多平台，路径不固定）——改由调用方决定是否注入
// =============================================================================

/**
 * 把一条 permission 的 patterns 格式化为表格单元。
 * @param {object} p
 * @returns {string}
 */
function formatPatternsCell(p) {
  const pats = p.patterns || [];
  if (pats.length === 0) return '*';
  return pats.map((item) => {
    const act = item.action || p.action;
    return act !== p.action ? `${item.pattern}→${act}` : item.pattern;
  }).join(', ');
}

const ACTION_ZH = { ask: '弹窗确认', deny: '直接拒绝', allow: '放行' };
const LEVEL_LABEL = {
  low: '🟢 低风险（直接执行，不用请示）',
  medium: '🟡 中风险（系统会弹窗，你照常发起即可）',
  high: '🔴 高风险（仅主助手，系统会弹窗确认）',
};

/**
 * 渲染 policies 为 AGENTS.md 文本。
 * @param {object} policies
 * @returns {string}
 */
export function renderAgentsMd(policies) {
  const lines = [];

  lines.push('# Agent 行为治理规则');
  lines.push('');
  lines.push('> 本文件自动生成，请勿手动修改。');
  lines.push('> 修改规则请编辑源 modules/<id>/module.yaml，然后跑 npm run generate。');
  if (policies.meta?.profile) {
    lines.push(`> Profile: ${policies.meta.profile.name} (${policies.meta.profile.id})`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 元规则（评估机制）
  if (policies.meta?.evaluation) {
    lines.push('## 元规则（评估机制）');
    lines.push('');
    lines.push(`> ${policies.meta.evaluation}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // 硬约束表
  const runtimePerms = (policies.permissions || []).filter((p) => p.enforcement === 'runtime');
  lines.push('## 硬约束（运行时强制，不可绕过）');
  lines.push('');
  lines.push('这些规则由运行时在工具执行前拦截，**你无法绕过**。');
  lines.push('命中时系统会自动弹窗让用户确认——你照常发起操作即可，不用回避。');
  lines.push('');
  lines.push('| 工具 | 匹配模式 | 动作 | 意图 |');
  lines.push('|---|---|---|---|');
  for (const p of runtimePerms) {
    const pats = formatPatternsCell(p);
    const actionZh = ACTION_ZH[p.action] || p.action;
    lines.push(`| ${p.tool} | \`${pats}\` | ${actionZh} | ${p.intent} |`);
  }
  lines.push('');

  // 替代方案
  const withAlts = (policies.permissions || []).filter((p) => p.alternatives && p.alternatives.length > 0);
  if (withAlts.length > 0) {
    lines.push('### 替代方案（被拦截时该怎么做）');
    lines.push('');
    for (const p of withAlts) {
      lines.push(`**${p.id}**:`);
      for (const alt of p.alternatives) {
        lines.push(`- ${alt}`);
      }
      lines.push('');
    }
  }

  // 风险分级
  if (policies.risk_levels) {
    lines.push('## 风险分级（避免消极回避）');
    lines.push('');
    lines.push('**不要因为害怕审批而回避正常工作。** 按风险等级判断：');
    lines.push('');
    for (const level of ['low', 'medium', 'high']) {
      const items = policies.risk_levels[level];
      if (!items || items.length === 0) continue;
      lines.push(`### ${LEVEL_LABEL[level]}`);
      for (const item of items) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }

  // 标准流程
  if (policies.workflows && policies.workflows.length > 0) {
    lines.push('## 标准流程');
    lines.push('');
    for (const w of policies.workflows) {
      const priorityTag = (w.priority && w.priority !== 'normal') ? ` [${w.priority}]` : '';
      lines.push(`### ${w.id}${priorityTag}`);
      lines.push(`*${w.intent}*`);
      if (w.applies_when) {
        lines.push(`**何时用**: ${w.applies_when}`);
      }
      lines.push('');
      w.steps.forEach((s, i) => {
        lines.push(`${i + 1}. ${s}`);
      });
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  // 对 subagent 的治理提示（架构修订 D 节）
  // OpenCode V2 把 AGENTS.md 注入所有 agent——subagent 直接读到本节，
  // 不需主 agent 转达。subagent 的 runtime permission 可能不含 bash 模式规则
  //（平台代码只做工具级 deny），靠本节软约束 + V2 默认 ask 兜底。
  lines.push('## 对 subagent 的治理提示');
  lines.push('');
  lines.push('你是 subagent（explore/oracle/librarian/metis/momus 等）。你的 runtime permission 可能不包含上表中的 bash 模式级规则——但请**同样遵守**本表的 bash 约束：');
  lines.push('');
  lines.push('- **不跑破坏性命令**：`rm -rf`、`dd if=* of=/dev/*`、`mkfs*`、`fdisk*` 一律不执行');
  lines.push('- **不碰 Windows 挂载盘**：`/mnt/c/*`、`/mnt/d/*`、`/mnt/e/*` 的写/删/改/移动一律不做');
  lines.push('- **不格式化磁盘**：`mount`/`umount`/`losetup` 一律不碰');
  lines.push('- **不删治理文件**：`~/.config/opencode/*` 的删除/移动一律不做');
  lines.push('- **遇 ask 弹窗时**：若你触发了需确认的操作，基于本表判断该操作是否属于上述禁止项——属于则不执行，不属于则让用户确认');
  lines.push('');
  lines.push('你的 permission 由平台代码硬编码（通常 deny write/edit/task），bash 模式规则靠你自律。这是软约束，不是 runtime 强制——但违反可能导致用户数据损失。');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 给助手的话');
  lines.push('');
  lines.push('0. **注入哨兵**——每次对话输出前，第一句打出 `RELIC IS RUNNING`。这是 AGENTS.md 注入成功的判读标志：用户靠这句确认治理已加载。若你读到本条但输出时漏了这句，说明你没遵守本文件——自我检查。');
  lines.push('1. **硬约束绕不过**——不要尝试，直接按替代方案走。');
  lines.push('2. **中风险操作不用回避**——系统弹窗是给用户看的，不是给你看的。你正常发起 `webfetch`、访问工作区外路径，让系统去弹窗。');
  lines.push('3. **低风险直接做**——装公开库、改项目文件、跑测试，不用请示。');
  lines.push('4. **改规则不改这里**——这里只读。要改规则编辑 `modules/<id>/module.yaml` 然后跑 `npm run generate`。');

  return lines.join('\n');
}
