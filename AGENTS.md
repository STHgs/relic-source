# relic — 项目交接文件

> 跨 session/平台交接文件。任何 agent 进入本项目时必须先读取此文件再执行任务。
> 每轮 session 结束前（含中断退出）必须更新「当前进度」和「交接说明」区块。只写事实，不写推测。

## 1. 任务目标

- relic 是可插拔、可跨平台移植的个人 agent 配置系统：规则（rules）、工作流（workflows）、人设/性格（persona/personality）等以统一源维护、可长期演进，并随用户迁移到不同平台（OpenCode、Claude Code、Codex、Cursor 等）而无需从零重配。
- relic 是对现有 agent-governance 项目（~/.config/opencode/agent-governance/，git 仓库）的优化与扩展。agent-governance 现仅支持 OpenCode：以 policies.yaml 为唯一事实源，经 generate.mjs 生成 ~/.config/opencode/AGENTS.md 供运行时权限拦截使用。
- 命名来源：赛博朋克 2077 中承载 Johnny Silverhand 人格印记（engram）的 Relic 芯片——寓意"人格/人设封装在可移植载体中随身携带"。

## 2. 当前进度

- [x] 项目脚手架建成
- [x] 差距分析完成（4 支柱缺口 + 3 个前身 bug）
- [x] 地基方案产出 + 落盘到 output/v1/foundation-plan.md
- [x] 地基实施完成：W1→W5 全部 11 任务，21 提交，81 tests 0 fail，3 bug 全修复
- [x] 方案 A：用户自定义流程入口补全——CLI 入口（generate + inject）+ 对话式入口（add-permission/add-workflow workflow 渲染），4 提交，107 tests 0 fail
- [ ] 方案 B（token 优化）/ 人设 / Codex-Cursor 适配器 / 模块化 / 迁移策略（待用户启动）

## 3. 关键决策

- 结论：脚手架保持最小化，仅含标准结构（AGENTS.md + interaction/ + output/ + git 基础文件），不预建 src/ 等架构目录。理由：目录结构应由架构设计产出，避免推测性结构返工。
- 结论：git init 在脚手架阶段即执行（分支 main）。理由：前身项目即 git 仓库，从第 0 号提交开始留痕，脚手架提交即为可回滚基线。
- 结论：output/ 初始为空（无 v1）。理由：版本目录在有产物时才创建，禁止空版本。
- 结论：仓库添加 .gitattributes 固定 LF 换行。理由：仓库位于 Windows 挂载盘（/mnt/e），防 WSL/Windows 工具链换行符漂移。
- 结论：开发期间不改动 ~/.config/opencode/agent-governance/ 现网配置。理由：它是当前 OpenCode 运行时治理的生效来源，迁移需待架构设计后专项决策。
- 结论：地基先行（schema v2 权威 + ajv 自动检具 + 平台适配器快换夹头），人设/Codex/Cursor/模块化延后。理由：地基晃则配件松，先固地基再装配件。
- 结论：relic 重新实现前身概念，不拷贝前身文件打补丁。理由：避免带入前身 bug，且新结构干净。
- 结论：本阶段不引入 TypeScript，沿用前身 .mjs + JSDoc 工具链。理由：不增编译步骤，迭代快；TS 迁移记为未来选项。
- 结论（F1，用户拍板 2026-08-26）：丢弃 enforcement:hook 枚举。理由：双重死代码（无 hook 规则 + install 不装）、只支持 block（deny 已可由 runtime+deny 表达）、保留是漂移隐患。schema v2 enforcement 只剩 runtime/advisory，claude 适配器不产 claude.hooks.json。
- 结论（F2，用户拍板 2026-08-26）：bash 规则必带 patterns（保留前身语义）。理由：逼规则写具体，避免"无条件 deny all bash"这种粗粒度规则。schema v2 用 if/then 强制。
- 结论（F3，默认）：Claude 全局安装路径 ~/.claude/AGENTS.md。理由：relic 规范命名，路径常量易改。
- 结论（地基架构）：PlatformAdapter 接口 detect/generate/install 三段，适配器列表显式注入 orchestrator（不硬编码 import 全部）。理由：将来加 Codex/Cursor 只做新夹头，不动刀架与 orchestrator。
- 结论（native OpenCode role-flattening）：所有 runtime 权限应用到所有 native agent（general/build/explore）。理由：原生 OpenCode 无 applies_to 角色轴，过包含安全（runtime 仍按 pattern ask/deny）。忠实端口自前身。
- 结论（A2 CLI，2026-08-26）：generate 默认真写（用户跑 generate 即想生效），inject 默认 dry-run（安全第一，前身语义）。理由：generate 是幂等重写、inject 是追加有副作用，风险等级不同。
- 结论（A3 入口建模，2026-08-26）：对话式加规则入口建模为 policies.yaml 的 workflow（add-permission/add-workflow），渲染进 AGENTS.md，不做独立 skill 文件。理由：skill 是 OpenCode 专有概念，Claude/Codex/Cursor 没有；workflow 渲染到所有平台读的 AGENTS.md，单一源维护、跨平台、零新增格式。触发词写进 applies_when 弥补无硬触发。

## 4. 已知约束

- 写 /mnt/e（Windows 盘）属复杂任务，必须先出方案并获用户批准（plan-then-build），批准词如 build/实施/开始改/go。
- 本文件全文 ≤200 行，只写事实不写推测；每轮 session 结束前必须更新「当前进度」与「交接说明」。
- output/ 内产物按版本号独立存放（大改 v1/v2/v3，小改 v1.1/v1.2），禁止覆盖旧版本；新版本 = 复制上一版本 + 修改；原版本有缺陷时在本文件标注缺陷与修复版本号，不删除原版本。
- 打包产物（如 zip）放工作区根目录 /mnt/e/AIworkspace/ 下，与本项目主文件夹平级。
- 用户输入与反馈材料（截图、需求、bug 反馈）保存进 interaction/；处理用户反馈时先 `ls -lt` 查看该文件夹最新文件。

## 5. 文件地图

- AGENTS.md — 本文件，跨 session/平台交接文件
- interaction/ — 用户输入与反馈材料；初始为空
- output/ — agent 产物；现有 v1/foundation-plan.md（地基方案文档）
- policies.yaml — relic 自身初始规则册（5 权限 + 5 流程含 add-permission/add-workflow 入口 + 风险分级）
- package.json / package-lock.json — ESM 工具链（ajv@8.20.0 + yaml@2.9.0, node≥20）
- schema.json — v2 唯一权威契约（enforcement 无 hook，personas/modules 预留槽位）
- src/ — 源码：
  - core/ — loader / validator(ajv) / permission-map / conflict(3 层) / inject（+CLI 入口）
  - render/ — agents-md.mjs（AGENTS.md 渲染器）
  - adapters/ — base / opencode / omo / claude（3 平台适配器）
  - orchestrator/ — generate.mjs（detect→generate→install 流水线 + CLI 入口）
  - index.mjs — 公共 API 门面（pipeline 一条龙）
- tests/ — 11 个 .test.mjs + fixtures/（3 yaml 样本）；`npm test` 跑 107 tests
- .gitignore / .gitattributes — git 基础配置
- （前身，只读参考，未迁移）~/.config/opencode/agent-governance/

## 6. 交接说明

**上轮做了**（含本轮 2026-08-26）：
- 此前各轮：建成脚手架；差距分析（4 支柱 + 3 bug）；调规划 agent 产出地基方案；落盘方案到 output/v1/；按 W1→W5 执行全部 11 任务，3 bug 全修复，81 tests 0 fail。
- 本轮（方案 A：用户自定义流程入口补全）：
  - A1：orchestrator/generate.mjs 加 CLI 入口（`npm run generate [-- --dry-run]`，默认真写，F2）
  - A2：core/inject.mjs 加 CLI 入口（`node src/core/inject.mjs --type=... [--dry-run|--apply] '<JSON>'`，默认 dry-run，F3；--apply 后自动 spawn generate；退出码 0/1/2/3/4 保留前身语义）
  - A3：对话式入口建模为 policies.yaml 的 workflow（add-permission/add-workflow），渲染进 AGENTS.md 各平台读；不做 skill 文件（skill 是 OpenCode 专有，workflow 跨平台）；触发词写进 applies_when
  - 新增 relic/policies.yaml 初始样本（5 权限 + 5 流程含 2 个入口 workflow + 风险分级）
  - 新增 tests/cli.test.mjs（16 tests G1-G3+I1-I4）+ tests/workflows.test.mjs（10 tests）
  - 4 提交（4e2300c policies / 36e0c78 generate CLI / 15cc688 inject CLI / 6f97fb9 workflows）；全量 107 tests 0 fail；未碰现网。

**下轮该做**：
- 方案 A 已完成。下轮候选：① 方案 B（token 优化——看现网 AGENTS.md ~2200 tokens/session 哪些能精简，渲染层低风险）；② 人设功能；③ Codex/Cursor 适配器；④ 模块/pack 系统；⑤ 迁移策略决策。
- 任何新阶段先调规划 agent 出方案（plan-then-build 硬规则），方案入 output/v2/ 或 v1.1/。

**待澄清**（F1/F2/F3 已落地，剩余为新阶段决策）：
- ✅ F1 丢 hook / ✅ F2 bash 必带 patterns / ✅ F3 Claude 路径 ~/.claude/AGENTS.md（均落地）
- 迁移策略：relic 成熟后是原地替换 agent-governance、软链过渡，还是长期共存？
- 第二个目标平台是哪个（Codex/Cursor）？
- persona 范畴边界（语气风格？行为偏好？记忆？）——schema 槽位已留 {id,name,tone,directives[]}，功能待做。
- 前身 skills/（workflow、permission）是否随迁入 relic？——A3 已答：不迁 skill 文件，入口逻辑建模为 workflow。
- output/ 版本产物是否纳入 git 跟踪（当前默认跟踪）？
- ✅ 地基方案完整 11 任务详情在 relic/output/v1/foundation-plan.md。
