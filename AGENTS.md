# relic — 项目交接文件

> 跨 session/平台交接文件。任何 agent 进入本项目时必须先读取此文件再执行任务。
> 每轮 session 结束前（含中断退出）必须更新「当前进度」和「交接说明」区块。只写事实，不写推测。

## 1. 任务目标

- relic 是可插拔、可跨平台移植的个人 agent 配置系统：规则（rules）、工作流（workflows）、人设/性格（persona/personality）等以统一源维护、可长期演进，并随用户迁移到不同平台（OpenCode、Claude Code、Codex、Cursor 等）而无需从零重配。
- relic 是对现有 agent-governance 项目（~/.config/opencode/agent-governance/，git 仓库）的优化与扩展。agent-governance 现仅支持 OpenCode：以 policies.yaml 为唯一事实源，经 generate.mjs 生成 ~/.config/opencode/AGENTS.md 供运行时权限拦截使用。
- 命名来源：赛博朋克 2077 中承载 Johnny Silverhand 人格印记（engram）的 Relic 芯片——寓意"人格/人设封装在可移植载体中随身携带"。

## 2. 当前进度

- [x] 项目脚手架建成：/mnt/e/AIworkspace/relic（AGENTS.md、interaction/、output/、.gitignore、.gitattributes），git main 分支 2 个原子提交
- [x] 差距分析完成：读完 agent-governance 全部源码，产出 4 支柱缺口矩阵 + 3 个前身 bug 清单
- [x] 地基方案产出（规划 agent 8m46s 决策完备）：schema v2 + ajv 检具 + 3 平台快换夹头 + bug 修复 + TDD，11 任务 5 波次
- [x] 地基方案落盘：relic/output/v1/foundation-plan.md（2026-08-26）
- [x] 地基实施完成：W1→W5 全部 11 任务，17 个原子提交（含脚手架/文档共 21 提交），81 tests 0 fail，3 bug 全修复
- [ ] 人设功能 / Codex/Cursor 适配器 / 模块化系统（地基之后，待用户启动）

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

## 4. 已知约束

- 写 /mnt/e（Windows 盘）属复杂任务，必须先出方案并获用户批准（plan-then-build），批准词如 build/实施/开始改/go。
- 本文件全文 ≤200 行，只写事实不写推测；每轮 session 结束前必须更新「当前进度」与「交接说明」。
- output/ 内产物按版本号独立存放（大改 v1/v2/v3，小改 v1.1/v1.2），禁止覆盖旧版本；新版本 = 复制上一版本 + 修改；原版本有缺陷时在本文件标注缺陷与修复版本号，不删除原版本。
- 打包产物（如 zip）放工作区根目录 /mnt/e/AIworkspace/ 下，与本项目主文件夹平级。
- 用户输入与反馈材料（截图、需求、bug 反馈）保存进 interaction/；处理用户反馈时先 `ls -lt` 查看该文件夹最新文件。

## 5. 文件地图

- AGENTS.md — 本文件，跨 session/平台交接文件
- interaction/ — 用户输入与反馈材料；初始为空
- output/ — agent 产物，按版本独立存放；现有 v1/foundation-plan.md（地基方案文档）
- package.json / package-lock.json — ESM 工具链（ajv@8.20.0 + yaml@2.9.0, node≥20）
- schema.json — v2 唯一权威契约（enforcement 无 hook，personas/modules 预留槽位）
- src/ — 源码：
  - core/ — loader.mjs（YAML 读取）/ validator.mjs（ajv 校验）/ permission-map.mjs（共享映射）/ conflict.mjs（3 层冲突检测）/ inject.mjs（安全注入+回滚）
  - render/ — agents-md.mjs（AGENTS.md 渲染器）
  - adapters/ — base.mjs（契约+辅助）/ opencode.mjs / omo.mjs / claude.mjs（3 平台适配器）
  - orchestrator/ — generate.mjs（detect→generate→install 流水线）
  - index.mjs — 公共 API 门面（pipeline 一条龙）
- tests/ — 9 个 .test.mjs + fixtures/（3 个 yaml 样本）；`npm test` 跑 81 tests
- .gitignore / .gitattributes — git 基础配置
- （前身项目，只读参考，未迁移）~/.config/opencode/agent-governance/ — policies.yaml、schema.json、generate.mjs、lib/、install.sh、rollback-plan-then-build.sh、generated/、backups/、skills/

## 6. 交接说明

**上轮做了**（含本轮 2026-08-26）：
- 此前各轮：建成脚手架；差距分析（4 支柱 + 3 bug）；调规划 agent 产出地基方案（11 任务 5 波次）；落盘方案到 output/v1/foundation-plan.md；用工科通用语言解释架构。
- 本轮：用户拍板 F1（丢 hook）+ F2（bash 必带 patterns）+ 给 go；按 W1→W5 执行全部 11 任务——
  - W1（T1+T2，3 提交）：package.json + schema.json v2 + 3 fixtures
  - W2（T3/T4/T5/T6/T7，5 提交）：validator(ajv) + loader + permission-map + conflict(3 层) + agents-md 渲染器 + adapter base
  - W3（T8+T9，2 提交）：opencode/omo/claude 三适配器 + inject（bug#1 修复：patterns 全链路对象化）
  - W4（T10，1 提交）：orchestrator generate.mjs + index.mjs 公共 API
  - 全量 81 tests 0 fail；3 bug 全修复（#1 patterns 对象化 / #2 hook 删 / #3 ajv 真接通）；未碰现网 agent-governance。
- 本轮收尾：更新本文件 4 区块（当前进度/关键决策/文件地图/交接说明）+ 最终提交。

**下轮该做**：
- 地基已完成。下轮由用户决定下一步方向（候选见「待澄清」），不再有"等 go 开干"的待办。
- 优先级建议（待用户确认）：① 人设功能实现（schema 槽位已留，做生成器+各平台 persona 落点）；② Codex 或 Cursor 适配器（刀架就绪，做新夹头）；③ 模块/pack 系统（schema 槽位已留，做 dir-of-fragments + loader/merger）；④ 迁移策略决策（替换/软链/共存）。
- 任何新阶段都应先调规划 agent 出方案（plan-then-build 硬规则），方案入 output/v2/ 或 v1.1/。

**待澄清**（地基已定，剩余为新阶段决策）：
- ✅ F1 丢弃 hook（已拍板并落地）
- ✅ F2 bash 必带 patterns（已拍板并落地）
- ✅ F3 Claude 路径 ~/.claude/AGENTS.md（默认落地）
- 迁移策略：relic 成熟后是原地替换 agent-governance、软链过渡，还是长期共存？
- 第二个目标平台是哪个（Codex/Cursor，地基之后做）？
- persona 范畴边界（语气风格？行为偏好？记忆？）——schema 槽位已留 {id,name,tone,directives[]}，功能待做。
- agent-governance 中的 skills/（workflow、permission）是否随迁入 relic？
- output/ 版本产物是否纳入 git 跟踪（当前默认跟踪）？
- ✅ 地基方案完整 11 任务详情在 relic/output/v1/foundation-plan.md。
