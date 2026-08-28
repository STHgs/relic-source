# Findings Staging — 待并入 v4.1 的讨论结论

**Document:** findings-staging (NOT a versioned plan)
**Date:** 2026-08-28
**Status:** 暂存区。本文件汇总本会话多轮讨论的实据结论，待用户宣布讨论结束后，连同 v4.0 基线一并整合为 `v4.1`。**本文件不是正式版**，不替代 v4.0。
**Purpose:** 防止讨论结论丢失。每条均含实据来源（librarian 三轮查证 / 直接读源码）。

---

## A. 版本管理方案（已在 v4.0 落盘基线）

- 双轨分离：relic-core（GitHub 公开）+ relic-deploy（本地 `/mnt/e/`，抗 WSL 重置）
- 自定义态用本地 tag `deploy/<ts>` + `git bundle` 导出，不用 branch-per-deploy
- 参见 `output/v4/version-management-plan.md`（基线，不覆盖）
- **待 v4.1 整合点**：A 节无需改，直接作为 v4.1 的版本管理章节基线

---

## B. omo 适配器有效性（三轮 librarian 查证）

### B1. 第一轮：OMO agent permission 的真实来源

**结论：7/11 OMO agent 无 omo.jsonc permission 块，但非裸奔——治理来自 TS 工厂硬编码。**

`~/.omo/omo.intranet.jsonc` 定义 11 个 agent，仅 4 个有 `permission` 字段（sisyphus/hephaestus/sisyphus-junior/atlas）。其余 7 个（prometheus/oracle/metis/momus/explore/librarian/multimodal-looker）的 permission 来自 OMO 插件 TS 工厂函数 `createAgentToolRestrictions()`，**不读 omo.jsonc**。

证据（librarian 引 oh-my-openagent 源码）：
- oracle: `permission: { write:"deny", edit:"deny", apply_patch:"deny", task:"deny" }` — `packages/omo-opencode/src/agents/oracle.ts`
- librarian: 同上 + `call_omo_agent:"deny"` — `librarian.ts`
- explore: deny 上述 + allow LSP 工具 — `explore.ts`
- multimodal-looker: `{"*":"deny", read:"allow"}` — `multimodal-looker.ts`
- metis/momus: `write/edit/apply_patch:"deny"` — 各自 agent.ts

**待 v4.1 整合点**：记录"omo.jsonc 不是 subagent permission 的来源"，但不构成缺口（subagent 有平台硬编码治理）。

### B2. 第二轮：relic 注入对 sisyphus 是否 LIVE

**结论：LIVE——经 agentOverrides 路径生效，不经 config.agent 路径。**

sisyphus 有两条注入路径：
- **Path 1（LIVE）**：`omo.jsonc [opencode].agents.sisyphus.permission` → OMO 插件配置 schema (`AgentOverridesSchema`) → `maybeCreateSisyphusConfig()` → `applyOverrides()` → `deepMerge()` 字段级覆盖到代码基线 `buildSisyphusPermission(model)` 上
- **Path 2（DEAD）**：作为原生 OpenCode agent 条目 → `filterProtectedAgentOverrides()` 整条剥掉（builtin 名受保护）

证据（librarian 引源码 + file:line）：
- `buildSisyphusPermission()` 硬编码基线 `{ question:"allow", call_omo_agent:"deny" }` — `sisyphus-agent-config.ts:9-14`
- `mergeAgentConfig()` 用 `deepMerge(base, rest)` 把用户 permission 覆盖到基线 — `agent-overrides.ts:42-58`
- `filterProtectedAgentOverrides` 剥掉同名 builtin 整条 — `agent-override-protection.ts:22-27`

**待 v4.1 整合点**：omo 适配器有运行时价值，应保留。sisyphus/hephaestus/sisyphus-junior 经 agentOverrides 路径 LIVE。atlas 存疑（有 omo.jsonc permission 但无代码 permission，依赖平台默认）。

### B3. 第三轮：AGENTS.md 注入范围

**结论：AGENTS.md 送达所有 agent，不限于主 agent——"AGENTS.md 读者 = 主 agent"假设不成立。**

OpenCode V2 + OMO 有四条 AGENTS.md 注入路径，全部不限于主 agent：
1. OpenCode V2 session 级 instructions（`~/.config/opencode/AGENTS.md`）→ **所有 agent** — V2 docs 明确
2. OMO `directory-agents-injector`（读文件时触发）→ 所有 agent
3. OMO `rules-injector`（read/write/edit 时触发）→ 所有 agent
4. OMO `hephaestus-agents-md-injector`（chat message 层）→ **仅 Hephaestus**（不是 sisyphus）

**关键利好**：relic 只需写好 AGENTS.md，平台自动送达所有 agent——subagent 直接读到治理规则，不需主 agent 中转。

**待 v4.1 整合点**：劝导层 AGENTS.md 应明确"所有 agent 都读"，可直接对 subagent 说话（"你是 subagent，请遵守本表 bash 约束"），而非只对主 agent 说再让它转达。

---

## C. subagent 治理盲区（残留风险）

**结论：relic 的 bash 模式级规则够不到 subagent，但风险低到中。**

- subagent 各跑各的 permission，**不继承 sisyphus**（OpenCode V2 文档明文）
- subagent permission 来自 OMO TS 工厂（工具级 deny：write/edit/task），**不含 bash 模式规则**
- V2 默认"无匹配规则 = ask"：
  - sisyphus 跑 `rm -rf /*` → relic deny ✓
  - **oracle 跑 `rm -rf /*` → 无匹配 → ask**（弱化，非 deny）

兜底：OMO 工厂已 deny write/edit/apply_patch/task（subagent 不能改文件/派任务）；ask 弹窗到用户有机会拦。

**待 v4.1 整合点**：记录残留风险为"可接受"。AGENTS.md 增节直接对 subagent 约束（靠 LLM 自律，非 runtime 强制）。

---

## D. 架构方案：只治主 agent + AGENTS.md 劝导（用户提出，已验证修正）

**用户原方案**：只对主 agent 做 runtime 限制，AGENTS.md 提示主 agent 主动治理 subagent。

**修正后方案**（基于 B3 实据）：

| 层 | 管谁 | 怎么实现 | 效力 |
|---|---|---|---|
| 执行层 runtime | **只主 agent**（primary） | 适配器只注入 `applies_to:[primary]` 的 permission，`PRIMARY_AGENT` 常量保留 | 硬约束 |
| 平台兜底层 | subagent | 不注入，靠平台默认（OMO 工厂 TS / V2 默认 ask） | 平台负责 |
| 劝导层 AGENTS.md | **所有 agent**（平台自动送达） | AGENTS.md 直接对 subagent 说话，不需主 agent 中转 | 软约束 |

**关键修正**：
1. **PRIMARY_AGENT 常量删不掉**——执行层要注入到具体 agent 名。但只保留一个常量（非整张 ROLE_TO_AGENTS 映射表）
2. **AGENTS.md 送达不用操心**——OpenCode V2 自动注入所有 agent。原方案"主 agent 转达"多余且信息损失
3. **AGENTS.md 增节**：直接对 subagent 说话——"你是 subagent，runtime 可能不含 bash 模式规则，但请遵守本表：不跑 rm -rf、不碰 /mnt/c|d|e、不格式化"

**`applies_to` 角色新语义**：
- 执行层：`deep/subagent/all` 失效（不注入）
- 劝导层：获得新语义——"这条规则也适用于 subagent，subagent 请遵守"

**适配器简化**（omo.mjs）：
- 删 `ROLE_TO_AGENTS` 全映射表 + `ALL_AGENTS`
- 只留 `PRIMARY_AGENT = 'sisyphus'`（OMO）/ `'general'`（opencode）
- `generate` 只处理 `applies_to` 含 `primary` 或 `all` 的规则

**待 v4.1 整合点**：作为 v4.1 的"架构修订"章节主体。

---

## E. 瑕疵：header over-claim（连回 key/分享决策）

**结论：`writeWithHeader` 把"自动生成 — 勿手改"加给整个 opencode.jsonc/omo.jsonc，但实际只有 `agent` 键是 relic 生成，provider/key/mcp 是用户维护。**

证据：`src/adapters/base.mjs:83-99` `writeWithHeader` 给整文件加头；`opencode.mjs:87` 写合并后的完整 `oc`。

含义：header 让人误以为整文件是产物，但用户**必须**手改 providers/key（relic 不管）。这解释了 key 为何会出现在"生成"文件里——头把责任归属说混了。直连 v4.0 §9 安全项：relic-deploy 若把 opencode.jsonc 整文件入库就泄 key。

**待 v4.1 整合点**：列为已知瑕疵，与 v4.0 §9 key 安全项合并处理。长期解法：adapter 走 env 注入 key（动源码）。

---

## F. 跨平台验证（后续研发路线，落盘）

### F1. 当前已验证（OpenCode V2 + OMO）

**结论：AGENTS.md 注入所有 agent，劝导层全覆盖。**

四条注入路径全部不限于主 agent（详见 B3）：
1. OpenCode V2 session 级 instructions → 所有 agent
2. OMO `directory-agents-injector`（读文件时触发）→ 所有 agent
3. OMO `rules-injector`（read/write/edit 时触发）→ 所有 agent
4. OMO `hephaestus-agents-md-injector`（chat message 层）→ 仅 Hephaestus

→ 在 OpenCode/OMO 平台，relic 劝导层自动全覆盖，不需主 agent 转达。

### F2. 后续研发路线（待接入时验证）

每接入一个新 harness，需验证两件事，决定该平台的劝导层策略：

| 验证项 | 是 | 否 |
|---|---|---|
| 该 harness 是否把指令文件（AGENTS.md / CLAUDE.md / .cursorrules / 同等物）注入**所有 agent**？ | 劝导层自动全覆盖，不需主 agent 转达 | 劝导层退化为只主 agent 读 + 主 agent 转达 subagent |
| 该 harness 的 primary agent 叫什么名字？ | 填入 `PRIMARY_AGENT` 常量（执行层） | — |

**目标 harness 清单（按优先级）：**
1. **Claude**（已有 claude 适配器骨架，FileMap 仅 AGENTS.md）——验证 CLAUDE.md 注入范围
2. **zcode / deepseek-harness**（未来）——验证 + 接入

**接入流程（每个新 harness）：**
1. 查清 primary agent 名 → 设 `PRIMARY_AGENT = '<name>'` 常量
2. 验证指令文件注入范围（所有 agent vs 仅主 agent）
3. 若全覆盖 → 劝导层无需额外声明（与 OpenCode/OMO 同）
4. 若仅主 agent → 劝导层退化为"主 agent 读 + 转达"，AGENTS.md 加 harness-specific 提示

### F3. 执行层与劝导层的新 harness 接入成本对比

| | 旧方案（ROLE_TO_AGENTS） | 简化后 |
|---|---|---|
| 新 harness 接入 | 画一张 4 角色映射表 + 摸清全部 agent 拓扑 | `PRIMARY_AGENT` 一个常量 + 一次 AGENTS.md 注入范围验证 |
| omo | `primary→sisyphus, deep→hephaestus, subagent→sisyphus-junior+atlas, all→4个` | `PRIMARY_AGENT = 'sisyphus'` |
| opencode 原生 | 同构 4 角色 | `PRIMARY_AGENT = 'general'` |
| Claude / zcode / deepseek-harness | 画整表 | 一个常量 + 一次验证 |

**待 v4.1 整合点**：作为 v4.1 的"跨平台验证研发路线"章节，标注当前已验证范围 + 待验证清单。

---

## v4.1 整合清单（待用户宣布讨论结束后执行）

- [ ] **§ 版本管理**：直接采用 v4.0 基线内容
- [ ] **§ omo 适配器有效性**：B1+B2 结论——保留 omo 适配器，sisyphus 经 agentOverrides LIVE
- [ ] **§ 架构修订**：D 节——只治主 agent + AGENTS.md 劝导所有 agent + PRIMARY_AGENT 保留
- [ ] **§ 残留风险**：C 节——subagent bash 规则盲区，可接受
- [ ] **§ AGENTS.md 渲染增强**：增节直接对 subagent 说话
- [ ] **§ 已知瑕疵**：E 节——header over-claim，与 key 安全项合并
- [ ] **§ 跨平台未验证项**：F 节——Claude/Cursor 劝导层覆盖率待查

---

*End of staging findings. 非正式版。待用户宣布讨论结束后整合为 v4.1。*
