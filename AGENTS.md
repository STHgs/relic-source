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
- [x] 方案 A：用户自定义流程入口补全——CLI 入口 + 对话式入口（workflow 渲染），107 tests
- [x] 方案 B 方向 3：模块化 + profile 按需加载——schema 增量改 + module-loader + 跨模块冲突 + CLI --profile/--module + round-trip 证明，6 提交，167 tests 0 fail
- [x] F-MIGRATE 执行：relic/policies.yaml 拆成 manifest + 5 modules/（sudo-safety/disk-protect/web-safety/build-hygiene/pdf-handling），3 profile（full=默认/work/personal），改 2 测试走 profile loader，round-trip 无损验证，1 提交，167 tests 0 fail
- [ ] 人设功能 / Codex-Cursor 适配器 / 迁移策略（待用户启动）

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
- 结论（方向 3 F1-F6，2026-08-26）：模块=目录（modules/<id>/module.yaml）；profile=schema 顶层 profiles 段；default:true 默认档；手工拆分迁移；整组模块切换；加载时全量冲突检测。理由：单一源维护 + 跨平台 + 检测早。
- 结论（F-VERSION）：schema 增量改不 bump version，保持 v2 additive。理由：向后兼容，107 现有测试不破坏。
- 结论（F-THREAD）：profile 名通过 meta.profile 传递（不加 adapter 签名改动）。理由：适配器零改动。
- 结论（F-MIGRATE=延迟，用户拍板 2026-08-26）：relic/policies.yaml 保持单文件，模块化系统用 tests/fixtures 证明 + round-trip 测试。实际拆分延后用户触发。理由：硬约束"107 现有测试不动且全绿"，拆分要改 2 个测试。低工作量后续。
- 结论（F-MIGRATE 执行，2026-08-26）：用户拍板执行拆分。relic/policies.yaml 变 manifest（meta+入口workflow inline+profiles+registry，permissions=[]）；规则正文进 modules/<id>/module.yaml（5 模块按内聚分组：sudo-safety/disk-protect/web-safety/build-hygiene/pdf-handling）。入口 workflow 留 inline（always-on，每 profile 都要能加规则）。规则+对应 risk_levels 归同一模块（切模块连风险项一起切）。改 2 测试（workflows.test.mjs 走 loadProfile；cli.test.mjs I3 复制 modules 到 scratch、I4 用 add-permission id clash）。round-trip 无损验证。理由：方向 3 机器已验证，拆真文件低风险；relic 自己的样本变模块化。

## 4. 已知约束

- 写 /mnt/e（Windows 盘）属复杂任务，必须先出方案并获用户批准（plan-then-build），批准词如 build/实施/开始改/go。
- 本文件全文 ≤200 行，只写事实不写推测；每轮 session 结束前必须更新「当前进度」与「交接说明」。
- output/ 内产物按版本号独立存放（大改 v1/v2/v3，小改 v1.1/v1.2），禁止覆盖旧版本；新版本 = 复制上一版本 + 修改；原版本有缺陷时在本文件标注缺陷与修复版本号，不删除原版本。
- 打包产物（如 zip）放工作区根目录 /mnt/e/AIworkspace/ 下，与本项目主文件夹平级。
- 用户输入与反馈材料（截图、需求、bug 反馈）保存进 interaction/；处理用户反馈时先 `ls -lt` 查看该文件夹最新文件。

## 5. 文件地图

- AGENTS.md — 本文件，跨 session/平台交接文件
- interaction/ — 用户输入与反馈材料；初始为空
- output/ — agent 产物；现有 v1/foundation-plan.md（地基方案）+ v2/direction3-plan.md（方向 3 方案）
- policies.yaml — manifest（模块化模式）：meta + 入口 workflow（add-permission/add-workflow，inline always-on）+ profiles（full=默认/work/personal）+ modules registry（5 模块）。规则正文已进 modules/
- modules/ — 5 个规则片段：sudo-safety / disk-protect / web-safety / build-hygiene / pdf-handling（每个 module.yaml 含 id + permissions/workflows/risk_levels 片段）
- package.json / package-lock.json — ESM 工具链（ajv@8.20.0 + yaml@2.9.0, node≥20）
- schema.json — v2 唯一权威契约（enforcement 无 hook，personas/modules 槽位已激活为 registry，profiles 增量加）
- src/ — 源码：
  - core/ — loader / validator(ajv,+createModuleValidator) / permission-map / conflict(3 层,+detectCrossModuleConflicts) / inject（+CLI 入口） / module-loader（loadProfile+mergeFragments，方向 3 核心）
  - render/ — agents-md.mjs（AGENTS.md 渲染器，+meta.profile 头）
  - adapters/ — base / opencode / omo / claude（3 平台适配器）
  - orchestrator/ — generate.mjs（流水线 + CLI 入口，+--profile）
  - index.mjs — 公共 API 门面（pipeline 一条龙，+profile 路由）
- tests/ — 16 个 .test.mjs + fixtures/（含 manifest.yaml + modules/ 模块样本 + bad-dupe-id）；`npm test` 跑 167 tests
- .gitignore / .gitattributes — git 基础配置
- （前身，只读参考，未迁移）~/.config/opencode/agent-governance/

## 6. 交接说明

**上轮做了**（含本轮 2026-08-26）：
- 此前各轮：建成脚手架；差距分析；地基方案（11 任务）；W1→W5 全部实施，3 bug 全修复，81 tests；方案 A（CLI + 对话式入口），107 tests；方案 B 方向 3（模块化 + profile，6 提交，167 tests）。
- 本轮（F-MIGRATE 执行 + profile 架构展示）：
  - 用户拍板执行 F-MIGRATE：relic/policies.yaml 拆成 manifest + 5 modules/（sudo-safety/disk-protect/web-safety/build-hygiene/pdf-handling）
  - manifest 含 meta + 入口 workflow inline（add-permission/add-workflow always-on）+ profiles（full=默认/work/personal）+ modules registry（5 模块）
  - 模块按内聚分组：规则+对应 risk_levels 归同一模块（切模块连风险项一起切）
  - 改 2 测试：workflows.test.mjs 走 loadProfile（断言不变）；cli.test.mjs I3 复制 modules 到 scratch、I4 用 add-permission id clash（type=workflow，因 sudo-ask 移到模块）
  - round-trip 无损验证：loadProfile(full) 渲染 == 原始（5 权限+5 流程+risk 5/3/4 全对上）
  - token 优化效果实测：full ~1037 tok / work ~982 tok / personal ~799 tok（规则增多后差距拉大）
  - 1 提交（dc27b3a）；全量 167 tests 0 fail；未碰现网。
  - 向用户展示了 profile 架构全景（manifest/modules/loadProfile 链路 + 3 profile 对比 + 加载流程）。

**下轮该做**：
- F-MIGRATE 已执行。下轮候选：① 人设功能（schema 槽位已留 {id,name,tone,directives[]}，做生成器+各平台 persona 落点）；② Codex/Cursor 适配器（刀架就绪，做新夹头）；③ 迁移策略决策（替换/软链/共存）；④ 方向 2 补充（workflow steps 折叠，进一步省 token）。
- 任何新阶段先调规划 agent 出方案（plan-then-build 硬规则），方案入 output/v3/ 或 v2.1/。

**待澄清**（F1-F6/F-MIGRATE 全部落地，剩余为新阶段决策）：
- ✅ F1-F6 方向 3 分叉全部落地
- ✅ F-MIGRATE 已执行（relic/policies.yaml 已拆成 manifest + modules/）
- 迁移策略：relic 成熟后是原地替换 agent-governance、软链过渡，还是长期共存？
- 第二个目标平台是哪个（Codex/Cursor）？
- persona 范畴边界（语气风格？行为偏好？记忆？）——schema 槽位已留，功能待做。
- output/ 版本产物是否纳入 git 跟踪（当前默认跟踪）？
- ✅ 方案详情：地基在 output/v1/foundation-plan.md，方向 3 在 output/v2/direction3-plan.md。
