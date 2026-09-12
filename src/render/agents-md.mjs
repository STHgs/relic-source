// =============================================================================
// src/render/agents-md.mjs — AGENTS.md 渲染器
// =============================================================================
// 架构：骨架 + 模块索引表
//   - 骨架（固定，不随自定义区变动）：硬约束表、替代方案、subagent 治理提示、给助手的话
//   - 模块索引表（极小）：workflow id + 触发条件，agent 按需 Read module.yaml
// workflows/risk_levels 详细步骤留在 modules/ 下，不渲染进 AGENTS.md，避免上下文浪费
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

  // 模块索引表（替代原风险分级+标准流程全量渲染）
  // workflows 和 risk_levels 的详细内容留在 modules/ 下的 yaml 文件中，
  // agent 按需用 Read 工具读取对应 module.yaml 获取步骤和风险分级。
  // AGENTS.md 只保留索引，保持精简，不随自定义内容增长。
  if (policies.workflows && policies.workflows.length > 0) {
    lines.push('## 自定义流程索引');
    lines.push('');
    lines.push('> 以下流程的详细步骤和风险分级存储在 `modules/` 下的 yaml 文件中。');
    lines.push('> 遇到相关任务时，用 Read 工具读取 `modules/<对应模块>/module.yaml` 获取完整步骤。');
    lines.push('');
    lines.push('| 流程 | 优先级 | 触发条件 | 文件路径 |');
    lines.push('|---|---|---|---|');
    for (const w of policies.workflows) {
      const priorityTag = (w.priority && w.priority !== 'normal') ? w.priority : 'normal';
      const trigger = w.applies_when ? w.applies_when.substring(0, 50) : '—';
      const modulePath = `modules/?/${w.id} (用 Glob: modules/*/${w.id} 定位)`;
      lines.push(`| ${w.id} | ${priorityTag} | ${trigger} | ${modulePath} |`);
    }
    lines.push('');
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
  lines.push('0. **注入哨兵**——每次对话输出前，第一句原样输出以下红色标记（diff 代码块的删除行在 UI 中渲染为红色）。`MMDD-HHMMSS` 换成输出时刻的时间戳（2位月2位日-2位时2位分2位秒，每轮现取，不得照抄本文件里的示例值）——时间戳证明标记是本 session 实时打出的，不是复读旧文本：');
  lines.push('````');
  lines.push('```diff');
  lines.push('- RELIC IS RUNNING @ MMDD-HHMMSS');
  lines.push('```');
  lines.push('````');
  lines.push('这是 AGENTS.md 注入成功的判读标志：用户靠这句确认治理已加载。若你读到本条但输出时漏了这句，说明你没遵守本文件——自我检查。');
  lines.push('1. **硬约束绕不过**——不要尝试，直接按替代方案走。');
  lines.push('2. **中风险操作不用回避**——系统弹窗是给用户看的，不是给你看的。你正常发起 `webfetch`、访问工作区外路径，让系统去弹窗。');
  lines.push('3. **低风险直接做**——装公开库、改项目文件、跑测试，不用请示。');
  lines.push('4. **改规则不改这里**——这里只读。要改规则编辑 `modules/<id>/module.yaml` 然后跑 `npm run generate`。');

  return lines.join('\n');
}
