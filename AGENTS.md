# relic — 项目交接文件

> 跨 session/平台交接文件。任何 agent 进入本项目时必须先读取此文件再执行任务。
> 每轮 session 结束前（含中断退出）必须更新「当前进度」和「交接说明」区块。只写事实，不写推测。

## 1. 任务目标

- relic 是可插拔、可跨平台移植的个人 agent 配置系统：规则（rules）、工作流（workflows）、人设/性格（persona/personality）等以统一源维护、可长期演进，并随用户迁移到不同平台（OpenCode、Claude Code、Codex、Cursor 等）而无需从零重配。
- relic 前身是 agent-governance 项目（~/.config/opencode/agent-governance/，git 仓库，policies.yaml 单文件 + generate.mjs + install.sh）。**2026-08-27 cutover 后 relic 已接管现网**：relic manifest+modules 是唯一事实源，前身 policies.yaml 已归档到 backups/。改规则编辑 relic/modules/<id>/module.yaml → `npm run generate` 生效。
- 命名来源：赛博朋克 2077 中承载 Johnny Silverhand 人格印记（engram）的 Relic 芯片——寓意"人格/人设封装在可移植载体中随身携带"。

## 2. 当前进度

- [x] 项目脚手架建成
- [x] 差距分析完成（4 支柱缺口 + 3 个前身 bug）
- [x] 地基方案产出 + 落盘到 output/v1/foundation-plan.md
- [x] 地基实施完成：W1→W5 全部 11 任务，21 提交，81 tests 0 fail，3 bug 全修复
- [x] 方案 A：用户自定义流程入口补全——CLI 入口 + 对话式入口（workflow 渲染），107 tests
- [x] 方案 B 方向 3：模块化 + profile 按需加载——schema 增量改 + module-loader + 跨模块冲突 + CLI --profile/--module + round-trip 证明，6 提交，167 tests 0 fail
- [x] F-MIGRATE 执行：relic/policies.yaml 拆成 manifest + 5 modules/（sudo-safety/disk-protect/web-safety/build-hygiene/pdf-handling），3 profile（full=默认/work/personal），改 2 测试走 profile loader，round-trip 无损验证，1 提交，167 tests 0 fail
- [x] 迁移策略方案产出（output/v3/migration-strategy-plan.md）：推荐 Option B 软链过渡；识别 GAP1+GAP2 硬阻塞；列 P1-P6 前置 + Tier1/Tier2 等价验证 + 回滚预案 + 6 决策点
- [x] 6 决策点全拍板：Q1=丢弃 skills(A3替代) / Q2=只 OpenCode / Q3=output 入 git / Q4=1轮快途 / Q5=归档到 backups / Q6=浅合并照搬
- [x] 迁移 build 执行（Wave1-3）：P1 omo 深合并+stripJsonc / P2 opencode 浅合并 / P3 rollback 脚本 / P5 Tier1 等价 harness / P6 Tier2 sentinel harness — 208 tests 0 fail，Tier1 PASS(omo 187==187/oc 147==147)，Tier2 PASS(all sentinels survived)
- [x] 模块忠实化：5 modules 补全缺失规则(mount-ask/edit-windows-ask/agent-self-protection/27 windows-write patterns/alternatives/pdf-write/project-scaffold workflow) — Tier-1b deep-equal PASS(relic manifest 产出与 live generated/ 内容等价)
- [x] P4 文档：Q1=丢弃 skills，A3 workflow 渲染替代（无代码，记录在本文件 §3）
- [x] Wave4 Cutover B→A 执行：relic install 真写现网（4 文件 written，3 backups，0 errors）→ sentinels 全存活（model/fallback_models/11 agents/provider/3 agents/AGENTS.md 软链→普通文件）→ live policies.yaml 归档到 backups/（Q5）→ 209 tests 207 pass 0 fail 2 skip（Tier1 skip 因 policies.yaml 已归档，预期）。**relic 现为唯一治理系统**。
- [ ] 人设功能 / Codex-Cursor 适配器（待用户启动）

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
- 结论（6 决策点，用户拍板 2026-08-27）：Q1=丢弃 skills（A3 workflow 渲染替代，无代码 P4）；Q2=只 OpenCode 近期（Tier1 只验证 opencode+omo）；Q3=output 入 git 跟踪；Q4=1 轮快途（Tier1+Tier2 全绿即切 B→A，无影子运行）；Q5=policies.yaml 归档到 backups（cutover 时 mv）；Q6=opencode 浅合并完全照搬现网（oc.agent={...(oc.agent||{}),...genAgent}）。理由：范围收敛、快途、低风险。
- 结论（GAP1 fix 架构，2026-08-27）：generate 保持扁平产出（{agent:{permission}}，匹配 live generated/ 形状 + Tier1 等价 + Option B 兼容），ALL merge 逻辑放 install。加 stripJsonc/parseJsonc/readJsonc 共享 helper 到 base.mjs（从 live install.sh 提取去重）。omo install 深合并 permission 进 [opencode].agents.<name>.permission（忠实端口 install.sh:87-94）。理由：改 generate 形状会破坏 Tier1 diff + live install.sh 消费。
- 结论（模块忠实化，2026-08-27）：5 modules 补全缺失规则至与 live policies.yaml 内容等价（mount-ask/edit-windows-ask/agent-self-protection/27 windows-write patterns/external-dir patterns/alternatives/pdf-write+project-scaffold workflow/sudo-ask 加 subagent）。Tier-1b deep-equal 验证 PASS。理由：Q5=归档 live policies.yaml 前，relic manifest 必须是忠实继任者。

## 4. 已知约束

- 写 /mnt/e（Windows 盘）属复杂任务，必须先出方案并获用户批准（plan-then-build），批准词如 build/实施/开始改/go。
- 本文件全文 ≤200 行，只写事实不写推测；每轮 session 结束前必须更新「当前进度」与「交接说明」。
- output/ 内产物按版本号独立存放（大改 v1/v2/v3，小改 v1.1/v1.2），禁止覆盖旧版本；新版本 = 复制上一版本 + 修改；原版本有缺陷时在本文件标注缺陷与修复版本号，不删除原版本。
- 打包产物（如 zip）放工作区根目录 /mnt/e/AIworkspace/ 下，与本项目主文件夹平级。
- 用户输入与反馈材料（截图、需求、bug 反馈）保存进 interaction/；处理用户反馈时先 `ls -lt` 查看该文件夹最新文件。

## 5. 文件地图

- AGENTS.md — 本文件，跨 session/平台交接文件
- interaction/ — 用户输入与反馈材料；初始为空
- output/ — agent 产物；现有 v1/foundation-plan.md + v2/direction3-plan.md + v3/migration-strategy-plan.md
- policies.yaml — manifest（模块化模式）：meta + 入口 workflow（add-permission/add-workflow，inline always-on）+ profiles（full=默认/work/personal）+ modules registry（5 模块）。规则正文已进 modules/
- modules/ — 5 个规则片段（已忠实化，与 live policies.yaml 内容等价）：sudo-safety（+subagent）/ disk-protect（+mount-ask/edit-windows-ask/agent-self-protection/27 windows-write patterns）/ web-safety（+external-dir patterns）/ build-hygiene（+project-scaffold workflow）/ pdf-handling（+pdf-write workflow）
- package.json / package-lock.json — ESM 工具链（ajv@8.20.0 + yaml@2.9.0, node≥20）
- schema.json — v2 唯一权威契约（enforcement 无 hook，personas/modules 槽位已激活为 registry，profiles 增量加）
- src/ — 源码：
  - core/ — loader / validator(ajv,+createModuleValidator) / permission-map / conflict(3 层,+detectCrossModuleConflicts) / inject（+CLI 入口） / module-loader（loadProfile+mergeFragments，方向 3 核心）
  - render/ — agents-md.mjs（AGENTS.md 渲染器，+meta.profile 头）
  - adapters/ — base（+stripJsonc/parseJsonc/readJsonc JSONC helpers）/ opencode（+install 浅合并 GAP2）/ omo（+install 深合并 GAP1）/ claude（3 平台适配器）
  - orchestrator/ — generate.mjs（流水线 + CLI 入口，+--profile）
  - index.mjs — 公共 API 门面（pipeline 一条龙，+profile 路由）
- scripts/ — rollback.mjs（P3 GAP4，restoreFromBackup+rollbackPaths+CLI）/ tier1-equivalence.mjs（P5，generate-only 等价 harness）/ tier2-sentinel.mjs（P6，install-semantics sentinel harness）
- tests/ — 20 个 .test.mjs + fixtures/（含 manifest.yaml + modules/ 模块样本 + bad-dupe-id）；`npm test` 跑 208 tests
- tests/ — 20 个 .test.mjs + fixtures/（含 manifest.yaml + modules/ 模块样本 + bad-dupe-id）；`npm test` 跑 209 tests
- scripts/ — rollback.mjs（回滚工具）/ tier1-equivalence.mjs（P5 等价 harness，cutover 后因 policies.yaml 归档 skip）/ tier2-sentinel.mjs（P6 sentinel harness）
- .gitignore / .gitattributes — git 基础配置
- （前身，已归档）~/.config/opencode/agent-governance/ — policies.yaml 已 mv 到 backups/policies.yaml.archived-20260827-cutover；generated/ + install.sh + generate.mjs + lib/ 仍在但 relic 不再用；只读参考可删

## 6. 交接说明

**上轮做了**（含本轮 2026-08-27）：
- 此前各轮：建成脚手架；差距分析；地基方案（11 任务）；W1→W5 全部实施，81 tests；方案 A（CLI + 对话式入口），107 tests；方案 B 方向 3（模块化 + profile，167 tests）；F-MIGRATE 拆分（manifest+5 modules，167 tests）；迁移策略方案产出（output/v3/）。
- 本轮（迁移 build + cutover 执行，209 tests 全绿）：
  - 6 决策点全拍板（Q1=丢弃 skills / Q2=只 OpenCode / Q3=output 入 git / Q4=1 轮快途 / Q5=归档到 backups / Q6=浅合并照搬）
  - P1-P6 全实施：omo 深合并+stripJsonc / opencode 浅合并 / rollback 脚本 / Tier1 等价 harness / Tier2 sentinel harness。Tier1 PASS(omo 187==187/oc 147==147)，Tier2 PASS(all sentinels survived)
  - 模块忠实化：5 modules 补全缺失规则。Tier-1b deep-equal PASS
  - 软链 cutover blocker 修复：opencode.mjs AGENTS.md 写前 unlink symlink（+1 test）
  - **Wave4 Cutover B→A 执行**：relic install 真写现网（4 文件 written，3 backups，0 errors）→ sentinels 全存活（model=glm-5.2/fallback=[minimax-m3,kimi-k3]/11 agents 全在/provider 2 providers 全在/AGENTS.md 软链→普通文件 10512 chars）→ live policies.yaml 归档到 backups/policies.yaml.archived-20260827-cutover（Q5）。**relic 现为唯一治理系统**。回滚预案：scripts/rollback.mjs + backups/*.bak.*

**下轮该做**：
- ✅ 迁移完成。relic 是现网唯一治理源（manifest+modules → generate → install）。
- 日常改规则：编辑 relic/modules/<id>/module.yaml → `npm run generate`（真写，A2 决策）→ 生效。
- 回滚（如需）：`node scripts/rollback.mjs`（恢复 3 路径最新 .bak）+ backups/policies.yaml.archived-*。
- 其他候选仍开放：人设功能 / Codex-Cursor 适配器 / 方向 2（workflow steps 折叠省 token）。
- 任何新阶段先调规划 agent 出方案（plan-then-build 硬规则）。

**待澄清**（迁移全落地）：
- ✅ 6 决策点全拍板 + 全执行
- ✅ GAP1+GAP2+GAP4 全修复，Tier1+Tier2+Tier1b PASS，模块忠实化 PASS
- ✅ Wave4 Cutover 执行成功，relic 为唯一治理系统
- ✅ Q1=丢弃 skills（A3 替代），P4 已记录
- 第二个目标平台是哪个（Codex/Cursor）？
- persona 范畴边界（语气风格？行为偏好？记忆？）——schema 槽位已留，功能待做。
- ✅ 方案详情：地基 output/v1/，方向 3 output/v2/，迁移策略 output/v3/migration-strategy-plan.md。
