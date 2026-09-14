# Agent 行为治理规则

> 本文件自动生成，请勿手动修改。
> 修改规则请编辑源 modules/<id>/module.yaml，然后跑 npm run generate。
> Profile: Probe (probe)

---

## 元规则（评估机制）

> «skeleton-probe»

---

## 硬约束（运行时强制，不可绕过）

这些规则由运行时在工具执行前拦截，**你无法绕过**。
命中时系统会自动弹窗让用户确认——你照常发起操作即可，不用回避。

| 工具 | 匹配模式 | 动作 | 意图 |
|---|---|---|---|
| bash | `probecmd *` | 弹窗确认 | «skeleton-probe» probe permission intent |

### 替代方案（被拦截时该怎么做）

**probe-perm**:
- «skeleton-probe»

## 风险分级（避免消极回避）

**不要因为害怕审批而回避正常工作。** 按风险等级判断：

### 🟢 低风险（直接执行，不用请示）
- «skeleton-probe»

### 🟡 中风险（系统会弹窗，你照常发起即可）
- «skeleton-probe»

### 🔴 高风险（仅主助手，系统会弹窗确认）
- «skeleton-probe»

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
1. **硬约束绕不过**——不要尝试，直接按替代方案走。
2. **中风险操作不用回避**——系统弹窗是给用户看的，不是给你看的。你正常发起 `webfetch`、访问工作区外路径，让系统去弹窗。
3. **低风险直接做**——装公开库、改项目文件、跑测试，不用请示。
4. **改规则不改这里**——这里只读。要改规则编辑 `modules/<id>/module.yaml` 然后跑 `npm run generate`。
5. **流程先读后行**——命中「自定义流程索引」任一行的触发条件时，必须先用 Read 工具读取该行「文件路径」指向的 yaml 正文，再按步骤执行；正文未读不得执行。