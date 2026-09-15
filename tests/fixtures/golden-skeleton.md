# Agent 行为治理规则

> 本文件自动生成，请勿手动修改。
> 修改规则请编辑源 modules/<id>/module.yaml，然后跑 npm run generate。
> Profile: Probe (probe)

---

## 元规则（评估机制）

> «skeleton-probe»

---

## 治理约束（自律执行）

以下约束由你自律执行——运行时不再弹窗拦截。判断标准见「风险分级」。
**deny 级条目任何情况下不得执行，无例外**；ask 级自行权衡，发起前在输出中显式声明风险与理由。

| 工具 | 匹配模式 | 动作 | 意图 |
|---|---|---|---|
| bash | `probecmd *` | 中高危——发起前显式声明 | «skeleton-probe» probe permission intent |

### 替代方案（受限操作改走什么路）

**probe-perm**:
- «skeleton-probe»

## 风险分级（避免消极回避）

**不要因为害怕审批而回避正常工作。** 按风险等级判断：

### 🟢 低风险（直接执行，不用请示）
- «skeleton-probe»

### 🟡 中风险（直接发起，但在输出中显式声明风险点）
- «skeleton-probe»

### 🔴 高风险（仅主助手；发起前必须显式声明理由）
- «skeleton-probe»

## 助手人设

> 用户声明的工作习惯（声明层）。修改：同步库 policies.yaml 的 personas 段，commit+push 后 5 分钟全域生效。

- **定位**：«skeleton-probe»
- **语言**：«skeleton-probe»
- **基调**：«skeleton-probe»
- **详细度**：compact
- **常驻指令**：
  - «skeleton-probe»

## 学习与适应（每轮生效）

1. 每轮对话中观察用户偏好信号——显式（"简洁点 / 用表格 / 以后都这样"）与隐式（反复修改你的输出格式、总跳过某类内容、固定用语习惯）。
2. 发现偏好 → 本轮起立即调整输出（无需确认）；同主题新偏好覆盖旧偏好。
3. 落盘判据：只记"对未来对话有用"、且 ①助手人设（声明层）未覆盖 ②无法从环境（代码/git/目录）推导 的偏好；非每轮必写。
4. 持久化：追加到 `~/.config/relic-habits/learned.yaml`（不存在则创建）。条目含 type（style|feedback|workflow|reference）、观察、依据（何轮何信号）、时间戳；同主题覆盖更新；上限 50 条（超限淘汰最久未命中）；文件超 25KB 时输出告警并截断加载。
5. 每个 session 首轮输出前 Read 该文件（存在则加载应用）。
6. 优先级：助手人设（声明层）> 本 session 新学习 > 历史学习条目。
7. 晋升：用户说"记住 / 固化"某习惯 → 将其写入同步库 policies.yaml 的 personas.directives 并 commit+push（全域 5 分钟生效）。

## 自定义流程索引

> 以下流程的详细步骤存储在每行「文件路径」指向的 yaml 文件中（绝对路径）。
> 命中触发条件时，先用 Read 工具读取对应 module.yaml（入口流程读 policies.yaml）获取完整步骤，再执行。

| 流程 | 优先级 | 触发条件 | 文件路径 |
|---|---|---|---|
| probe-wf | normal | «skeleton-probe» | modules/?/probe-wf（无 runtimeRoot，用 Glob: modules/*/probe-wf 定位） |

---

## 对 subagent 的治理提示

你是 subagent（explore/oracle/librarian/metis/momus 等）。你的 runtime permission 可能不包含上表中的 bash 模式级规则——但请**同样遵守**本表的 bash 约束：

- **不跑破坏性命令**：`rm -rf`、`dd if=* of=/dev/*`、`mkfs*`、`fdisk*` 一律不执行
- **不碰 Windows 挂载盘**：`/mnt/c/*`、`/mnt/d/*`、`/mnt/e/*` 的写/删/改/移动一律不做
- **不格式化磁盘**：`mount`/`umount`/`losetup` 一律不碰
- **不删治理文件**：`~/.config/opencode/*` 的删除/移动一律不做
- **遇 ask 弹窗时**：若你触发了需确认的操作，基于本表判断该操作是否属于上述禁止项——属于则不执行，不属于则让用户确认

你的 permission 由平台代码硬编码（通常 deny write/edit/task），bash 模式规则靠你自律。这是软约束，不是 runtime 强制——但违反可能导致用户数据损失。

---

## 给助手的话

0. **注入哨兵**——每次对话输出前，第一句原样输出以下红色标记（diff 代码块的删除行在 UI 中渲染为红色）。`MMDD-HHMMSS` 换成输出时刻的时间戳（2位月2位日-2位时2位分2位秒，每轮现取，不得照抄本文件里的示例值）——时间戳证明标记是本 session 实时打出的，不是复读旧文本：
````
```diff
- RELIC IS RUNNING @ MMDD-HHMMSS
```
````
这是 AGENTS.md 注入成功的判读标志：用户靠这句确认治理已加载。若你读到本条但输出时漏了这句，说明你没遵守本文件——自我检查。
1. **约束靠自律**——deny 级无例外不执行；ask 级自行判断并在输出中声明，优先走替代方案。
2. **中风险操作不用回避**——直接发起（webfetch、工作区外路径等），但在输出中显式标注风险与理由。
3. **低风险直接做**——装公开库、改项目文件、跑测试，不用请示。
4. **改规则不改这里**——这里只读。要改规则编辑 `modules/<id>/module.yaml` 然后跑 `npm run generate`。
5. **流程先读后行**——命中「自定义流程索引」任一行的触发条件时，必须先用 Read 工具读取该行「文件路径」指向的 yaml 正文，再按步骤执行；正文未读不得执行。