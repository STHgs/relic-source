// =============================================================================
// src/render/agents-md.mjs — AGENTS.md 渲染器
// =============================================================================
// 架构：骨架 + 模块索引表
//   - 骨架（固定，不随自定义区变动）：治理约束表（自律执行）、替代方案、风险分级（跨模块合并视图）、学习与适应（机制段）、助手人设（数据段头）、subagent 治理提示、给助手的话
//   - 模块索引表（极小）：workflow id + 触发条件，agent 按需 Read module.yaml
// workflow 详细步骤留在 modules/ 下不渲染进 AGENTS.md；risk_levels 是跨模块合并视图（无单一文件可指），常驻骨架
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

const ACTION_ZH = { ask: '中高危——发起前显式声明', deny: '禁止——任何情况不执行', allow: '放行' };
const LEVEL_LABEL = {
  low: '🟢 低风险（直接执行，不用请示）',
  medium: '🟡 中风险（直接发起，但在输出中显式声明风险点）',
  high: '🔴 高风险（仅主助手；发起前必须显式声明理由）',
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

  // 治理约束表（全量渲染，agent 自律执行——2026-09-15 去硬约束决策）
  const permRows = policies.permissions || [];
  lines.push('## 治理约束（自律执行）');
  lines.push('');
  lines.push('以下约束由你自律执行——运行时不再弹窗拦截。判断标准见「风险分级」。');
  lines.push('**deny 级条目任何情况下不得执行，无例外**；ask 级自行权衡，发起前在输出中显式声明风险与理由。');
  lines.push('');
  lines.push('| 工具 | 匹配模式 | 动作 | 意图 |');
  lines.push('|---|---|---|---|');
  for (const p of permRows) {
    const pats = formatPatternsCell(p);
    const actionZh = ACTION_ZH[p.action] || p.action;
    lines.push(`| ${p.tool} | \`${pats}\` | ${actionZh} | ${p.intent} |`);
  }
  lines.push('');

  // 替代方案
  const withAlts = (policies.permissions || []).filter((p) => p.alternatives && p.alternatives.length > 0);
  if (withAlts.length > 0) {
    lines.push('### 替代方案（受限操作改走什么路）');
    lines.push('');
    for (const p of withAlts) {
      lines.push(`**${p.id}**:`);
      for (const alt of p.alternatives) {
        lines.push(`- ${alt}`);
      }
      lines.push('');
    }
  }

  // 风险分级（跨模块合并视图——没有单一 module.yaml 可指，且约束每个动作的即时判断，常驻骨架）
  if (policies.risk_levels) {
    lines.push('## 风险分级（避免消极回避）');
    lines.push('');
    lines.push('**不要因为害怕审批而回避正常工作。** 按风险等级判断：');
    lines.push('');
    for (const level of ['low', 'medium', 'high']) {
      const items = policies.risk_levels[level];
      if (!items || items.length === 0) continue;
      lines.push(`### ${LEVEL_LABEL[level]}`);
      for (const item of items) lines.push(`- ${item}`);
      lines.push('');
    }
  }

  // 助手人设（L1 声明层：数据段，渲染 default persona；内容自由，骨架不动）
  const personas = policies.personas || [];
  const persona = personas.find((x) => x.default === true) ?? (personas.length === 1 ? personas[0] : undefined);
  if (persona) {
    lines.push('## 助手人设');
    lines.push('');
    lines.push('> 用户声明的工作习惯（声明层）。修改：同步库 policies.yaml 的 personas 段，commit+push 后 5 分钟全域生效。');
    lines.push('');
    if (persona.identity) lines.push(`- **定位**：${persona.identity}`);
    if (persona.language) lines.push(`- **语言**：${persona.language}`);
    if (persona.tone) lines.push(`- **基调**：${persona.tone}`);
    if (persona.verbosity) lines.push(`- **详细度**：${persona.verbosity}`);
    if (persona.directives && persona.directives.length > 0) {
      lines.push('- **常驻指令**：');
      for (const d of persona.directives) lines.push(`  - ${d}`);
    }
    lines.push('');
  }

  // 学习与适应（骨架：每轮自主学习的机制指令——人工奖励信号驱动，符号策略增量）
  lines.push('## 学习与适应（每轮生效）');
  lines.push('');
  lines.push('1. 每轮对话中观察用户偏好信号——显式（"简洁点 / 用表格 / 以后都这样"）与隐式（反复修改你的输出格式、总跳过某类内容、固定用语习惯）。');
  lines.push('2. 发现偏好 → 本轮起立即调整输出（无需确认）；同主题新偏好覆盖旧偏好。');
  lines.push('3. 落盘判据：只记"对未来对话有用"、且 ①助手人设（声明层）未覆盖 ②无法从环境（代码/git/目录）推导 的偏好；非每轮必写。');
  lines.push('4. 持久化：追加到 `~/.config/relic-habits/learned.yaml`（不存在则创建）。条目含 type（style|feedback|workflow|reference）、观察、依据（何轮何信号）、时间戳；同主题覆盖更新；上限 50 条（超限淘汰最久未命中）；文件超 25KB 时输出告警并截断加载。');
  lines.push('5. 每个 session 首轮输出前 Read 该文件（存在则加载应用）。');
  lines.push('6. 优先级：助手人设（声明层）> 本 session 新学习 > 历史学习条目。');
  lines.push('7. 晋升：用户说"记住 / 固化"某习惯 → 将其写入同步库 policies.yaml 的 personas.directives 并 commit+push（全域 5 分钟生效）。');
  lines.push('');

  // 模块索引表（workflow 详细步骤留在 modules/ 下，按需 Read——方向 2）
  // 路径 = meta.runtimeRoot（本机 clone 根）+ workflowSources 溯源；缺省时退化为 Glob 提示。
  if (policies.workflows && policies.workflows.length > 0) {
    lines.push('## 自定义流程索引');
    lines.push('');
    lines.push('> 以下流程的详细步骤存储在每行「文件路径」指向的 yaml 文件中（绝对路径）。');
    lines.push('> 命中触发条件时，先用 Read 工具读取对应 module.yaml（入口流程读 policies.yaml）获取完整步骤，再执行。');
    lines.push('');
    lines.push('| 流程 | 优先级 | 触发条件 | 文件路径 |');
    lines.push('|---|---|---|---|');
    const root = policies.meta?.runtimeRoot;
    const sources = policies.meta?.workflowSources || {};
    for (const w of policies.workflows) {
      const priorityTag = (w.priority && w.priority !== 'normal') ? w.priority : 'normal';
      const trigger = w.applies_when ? w.applies_when.substring(0, 50) : '—';
      const src = sources[w.id];
      let modulePath;
      if (root && src === 'manifest') modulePath = `${root}/policies.yaml`;
      else if (root && src) modulePath = `${root}/modules/${src}/module.yaml`;
      else modulePath = `modules/?/${w.id}（无 runtimeRoot，用 Glob: modules/*/${w.id} 定位）`;
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
  lines.push('1. **约束靠自律**——deny 级无例外不执行；ask 级自行判断并在输出中声明，优先走替代方案。');
  lines.push('2. **中风险操作不用回避**——直接发起（webfetch、工作区外路径等），但在输出中显式标注风险与理由。');
  lines.push('3. **低风险直接做**——装公开库、改项目文件、跑测试，不用请示。');
  lines.push('4. **改规则不改这里**——这里只读。要改规则编辑 `modules/<id>/module.yaml` 然后跑 `npm run generate`。');
  lines.push('5. **流程先读后行**——命中「自定义流程索引」任一行的触发条件时，必须先用 Read 工具读取该行「文件路径」指向的 yaml 正文，再按步骤执行；正文未读不得执行。');

  return lines.join('\n');
}
