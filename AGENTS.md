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
- [x] 哨兵提示词改造（2026-08-30）：注入哨兵改为 diff 围栏块（UI 渲染红色）+ MMDD-HHMMSS 每轮现取时间戳；cleanup-legacy-permissions.mjs 改为只删非主 agent 的 permission 字段。216→218 tests，全绿
- [x] 热插拔部署 + 分支生命周期：deploy/export CLI + git-ops + deploy-lifecycle + export-pack 模块，241 tests 239 pass 0 fail 2 skip（3 not ok 为预存 cli.test.mjs hook 问题，非本轮引入）。方案见 output/v4/deploy-export-plan.md。
- [x] dsh 适配器（路线 A）：新增 src/adapters/dsh.mjs（detect ~/.dsh, generate AGENTS.md only, install ~/.dsh/AGENTS.md）；orchestrator DEFAULT_ADAPTERS 加 dsh；adapters.test.mjs 加 A6 测试组（FileMap keys/round-trip/detect/install dryRun）；orchestrator.test.mjs + cli.test.mjs 从 3 平台→4 平台断言适配。248 tests 246 pass 0 fail 2 skip。决策：dsh 无 pattern 级 permission 模型（只有 session 级 ask/never + sandbox mode），放弃硬约束全部靠 agent 自治（advisory 渲染进 AGENTS.md）。
- [x] 单源同步 + roadmap 热加载（2026-09-12）：双库分叉收口（E 盘 wip + 部署库 dsh 适配器两侧分支化合并入 main，push GitHub 唯一权威源）；AGENTS.md 骨架化 15017B→8688B（workflow 正文按需 Read，绝对路径索引，规则 5 流程先读后行）；同步原语 npm run sync（Tier3 语义测试：脏拒/分叉拒/哨兵检）；271 tests 269 pass 0 fail 2 skip。方案 output/v5/sync-architecture-plan.md。
- [x] 骨架门禁 Tier4（2026-09-14）：静态骨架等价检查——golden 基准（探针策略渲染）+ 断言 A（等价，拦 renderer 漂移无 bump）+ 断言 B（不变，拦用户区触碰骨架）；sync generate 前真拦截 + GitHub CI 回归信号；280 tests 278 pass。方案 output/v6/skeleton-gate-plan.md。
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
- 结论（哨兵改造，2026-08-30）：注入哨兵从纯文本改为 diff 围栏块输出（markdown 无颜色语法，diff 删除行是 UI 中唯一可靠的红色渲染方案）+ `MMDD-HHMMSS` 每轮现取时间戳防复读旧文本（用户拍板格式）。理由：红色靠 diff 代码块实现，秒级时间戳证明实时性。
- 结论（热插拔部署，2026-08-28）：不拘泥单一源，deploy/export 两命令实现热插拔。每次 deploy 创建 git 分支追踪部署生命周期，export 封存分支并打 tag。理由：relic 三段式架构（detect→generate→install）天然支持从任意副本部署，单一源是前身软链习惯非架构约束；跨平台移植用命令代替链接更可控。
- 结论（dsh 适配路线 A，用户拍板 2026-09-05）：dsh adapter 只产 AGENTS.md，放弃 pattern 级硬约束，全部靠 agent 自治。理由：dsh 的 permission 模型只有 session 级 ask/never + sandbox mode（workspace-write/read-only/danger-full-access），不支持 pattern 级拦截（如 `sudo *`→ask）；relic 的 runtime permission 无法直接映射到 dsh 的 knob 模型。路线 A 与 claude adapter 同构（只产 AGENTS.md），detect=~/.dsh 目录存在，install 写 ~/.dsh/AGENTS.md。路线 B（写 dsh Cordis 插件注册 approval/request answerer 做 pattern 级 ask/deny）复杂度过高且 dsh v0.1 API 不稳，延后。
- 结论（单源架构 Q1-Q6，用户批准 2026-09-12）：Q1 GitHub 为唯一权威源（STHgs/relic）；Q2 部署副本=只读 clone+护栏（.relic-deploy 标记 + pre-commit 拒绝本地提交）；Q3 sync 触发=宿主调度器每 5 分钟（systemd/cron/TaskScheduler/launchd，relic 只提供平台无关原语）；Q4 CI 阶段 2 另行计划；Q5 产物不入库（拉取时本地 generate）；Q6 roadmap 渲染进阶段 1。理由：双库分叉事故的根因是部署位可写且无同步机制。
- 结论（同步通用性三原则，用户修订 2026-09-12）：①不对任何单一平台做特化适配（不写 DSH 专属钩子）②测试权威性=relic 自身测试体系（npm test + Tier1/2/3），单平台观察仅冒烟参考 ③9p 盘不跑测试（npm test 在 /mnt/e 超时，一切验证限定 ext4 dev clone）。理由：relic 是跨平台治理系统，DSH 只是受治理平台之一。
- 结论（roadmap 渲染架构 2026-09-12）：AGENTS.md=骨架（硬约束表+替代方案+风险分级+subagent 提示+哨兵+给助手的话）+索引表（绝对路径）；workflow 正文留在 modules/ 触发时 Read（全平台热加载）；风险分级是跨模块合并视图、无单一文件可指，常驻骨架；路径=meta.runtimeRoot（本机 clone 根，generate CLI 注入）+meta.workflowSources（mergeFragments 溯源，inline 流程指向 policies.yaml）。理由：注入层热加载是平台赠品（DSH 有 reconcile，其他平台未必），读时加载是唯一平台无关的热治理机制。
- 结论（一机一部署者 2026-09-12）：每台机器只有一个 clone 负责 generate+install（WSL=~/.config/relic dev clone；E盘库=归档/只读部署位，其 sync 不在本机部署）。理由：adapter 写 $HOME 路径，多 clone 同机部署会互相覆盖且 runtimeRoot 路径错乱。
- 结论（骨架静态原则，用户拍板 2026-09-14）：正式系统骨架是静态的——骨架=渲染器的唯一函数；任何用户自定义提交（modules/policies 内容）导致骨架行变更即违法。骨架变更唯一合法路径=renderer 代码与 golden 基准（tests/fixtures/golden-skeleton.md）同一提交更新，golden 的 diff 就是系统级变更的审查材料。实现：Tier4 双断言（A 等价/B 不变），sync generate 前硬拦截 + CI 回归信号。理由：门禁守护治理系统本身，用户主权内容零审查——语法与结构是系统的，语义与内容是用户的。
- 结论（门禁双点部署 2026-09-14）：GitHub CI 拦不住直推 main 的坏提交（push 即触发 5 分钟 sync 计时，CI 尚在跑），故真门禁必须内置 sync（骨架断言 <1s，全流程仍秒级）；CI 仅作远端独立复核与留痕。理由：拦截点必须在传播路径上，而非旁观者位置。

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
  - core/ — loader / validator(ajv,+createModuleValidator) / permission-map / conflict(3 层,+detectCrossModuleConflicts) / inject（+CLI 入口） / module-loader（loadProfile+mergeFragments，方向 3 核心） / **git-ops**（git 操作封装，deploy/export 用） / **deploy-lifecycle**（分支命名+序号+skill 清理） / **export-pack**（文件收集+HANDOFF.md+tar.gz）
  - render/ — agents-md.mjs（AGENTS.md 渲染器，+meta.profile 头）
  - adapters/ — base（+stripJsonc/parseJsonc/readJsonc JSONC helpers）/ opencode（+install 浅合并 GAP2）/ omo（+install 深合并 GAP1）/ claude（3 平台适配器）/ **dsh**（DeepSeek Harness 适配器，路线 A 只产 AGENTS.md）
  - orchestrator/ — generate.mjs（流水线 + CLI 入口，+--profile）
  - index.mjs — 公共 API 门面（pipeline 一条龙，+profile 路由）
- scripts/ — rollback.mjs（P3 GAP4）/ tier1-equivalence.mjs（P5）/ tier2-sentinel.mjs（P6）/ **deploy.mjs**（热插拔部署 CLI）/ **export.mjs**（导出封存 CLI）/ **sync.mjs**（同步原语 CLI，--init-deploy 装护栏）
- tests/ — 25 个 .test.mjs + fixtures/；`npm test` 跑 280 tests（278 pass 0 fail 2 skip）；sync.test.mjs=Tier3；skeleton.test.mjs=Tier4 三绿三红
- .gitignore / .gitattributes — git 基础配置（.gitignore 含 *.tar.gz 排除导出包）
- output/v4/deploy-export-plan.md — 热插拔部署+分支生命周期方案
- src/core/sync-core.mjs — 同步原语核心（runSync：脏拒/ff-only/哨兵检/状态；deployGuardHook）
- src/core/skeleton.mjs — 骨架门禁纯逻辑（探针策略/骨架行集抽取/断言A等价/B不变性）
- scripts/tier4-skeleton.mjs — 骨架门禁 CLI（--sync-check / --bump-golden 系统变更仪式 / CI 模式 HEAD~1 对比）
- tests/fixtures/golden-skeleton.md — golden 骨架基准（改 renderer 必须同 commit bump）
- .github/workflows/ci.yml — CI（npm ci → npm test → tier4）
- docs/SYNC.md — 同步语义 + 各平台宿主调度器接入（systemd/cron/TaskScheduler/launchd）
- output/v5/sync-architecture-plan.md — 单源同步+roadmap 热加载实施计划（已执行）
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
- 本轮（2026-08-30，哨兵改造）：注入哨兵改为 diff 围栏块（UI 渲染红色）+ MMDD-HHMMSS 每轮现取时间戳（agents-md.mjs + R5 测试，218 tests 全绿）；cleanup-legacy-permissions.mjs 从"整条删非主 agent"改为"只删 permission 字段"（保 OpenCode V2 default_agent fallback 链），上轮遗留随本轮提交；generate 真写现网已生效
- 本轮（热插拔部署，241 tests 全绿）：
  - 方案产出：output/v4/deploy-export-plan.md（热插拔部署+分支生命周期+导出封存）
  - 新增 3 核心模块：git-ops.mjs（git 操作封装）/ deploy-lifecycle.mjs（分支命名+序号+skill 清理）/ export-pack.mjs（文件收集+HANDOFF.md+tar.gz）
  - 新增 2 CLI 入口：scripts/deploy.mjs（remote 检测→分支创建→generate→清理→commit→push）/ scripts/export.mjs（确认 deploy 分支→打包+HANDOFF→tar.gz→tag+push）
  - 新增 3 测试文件：git-ops.test.mjs(15) + deploy-lifecycle.test.mjs(12) + export-pack.test.mjs(4) = 31 新测试全绿
  - package.json 加 deploy/export 脚本；.gitignore 加 *.tar.gz
- 本轮（dsh 适配器路线 A，248 tests 全绿）：
  - 新增 src/adapters/dsh.mjs：detect ~/.dsh 目录，generate 只产 AGENTS.md（与 claude adapter 同构），install 写 ~/.dsh/AGENTS.md
  - orchestrator DEFAULT_ADAPTERS 从 3 adapter→4 adapter（加 dshAdapter import + 数组追加）
  - tests/adapters.test.mjs 加 A6 测试组（A6 FileMap keys + AGENTS.md 内容、A6b round-trip、A6c detect、A6d install dryRun）共 9 断言
  - tests/orchestrator.test.mjs + tests/cli.test.mjs 从 3 平台→4 平台断言适配（makeEnv 加 dsh 字段、O1/O2/G1 的 skipped.length 3→4、fileMaps 断言加 dsh）
  - 决策记录：dsh 无 pattern 级 permission 模型（只有 session 级 ask/never + sandbox mode），放弃硬约束全部靠 agent 自治
- 本轮（2026-09-12，单源同步 + roadmap 热加载，271 tests 全绿）：
  - 事故诊断：注入文档全量渲染违背方向 2 设计；根因=双库分叉（E盘源码库 vs ~/.config/relic 部署库，8/28 分叉后互不知情，现网跑的是部署库旧渲染器）
  - 步骤0 双库收口：E盘 roadmap 半成品分支化（feat/roadmap-renderer-wip）+ 部署库脏改动分支化（feat/dsh-adapter）→ 无关历史合并入 main（--allow-unrelated-histories，per-file 裁定：main 为基底吸收 deploy 9/5 增量）→ push GitHub（relic 从此单源）
  - 步骤2 roadmap 补完：schema meta 增量扩展（runtimeRoot/workflowSources）；mergeFragments 溯源；generate CLI 注入 runtimeRoot；渲染器=骨架+绝对路径索引+风险分级常驻+规则5；R7 反转/R8/R9 新测试；跨模块风险条目去重
  - 步骤1 同步原语：src/core/sync-core.mjs + scripts/sync.mjs（npm run sync）+ docs/SYNC.md + Tier3 sync.test（S1-S6）+ 部署护栏（--init-deploy）
  - 部署验证：generate 真写 5 平台文件（opencode/omo/claude/dsh）全带 backup；Tier2 哨兵全存活；AGENTS.md 15017B→8688B；DSH 会话内亲测热注入（reconcile 机制两次触发，L4 冒烟）
  - E盘库归位 main@最新 + .relic-deploy 护栏（只读部署位）；systemd timer 单元已写入 ~/.config/systemd/user/（启用需沙箱外执行）
  - 修复：cli.test G2/G3/I3 时序脆弱模式（describe 体引用 beforeEach-scratch，多文件模式下竞态）

**下轮该做**：
- ✅ 迁移完成。relic 是现网唯一治理源（manifest+modules → generate → install）。
- 日常改规则：编辑 relic/modules/<id>/module.yaml → `npm run generate`（真写，A2 决策）→ 生效。
- **首次部署**：`npm run deploy`（会创建 GitHub 私有仓库 + deploy 分支）
- **导出封存**：`npm run export`（在 deploy 分支上跑，打 tar.gz + tag）
- 回滚（如需）：`node scripts/rollback.mjs`（恢复 3 路径最新 .bak）+ backups/policies.yaml.archived-*。
- ✅ 方向 2（roadmap 渲染）已完成（2026-09-12，含全平台热加载架构）。
- 其他候选仍开放：人设功能 / Codex-Cursor 适配器。
- ✅ dsh 适配器已完成（路线 A，只产 AGENTS.md，放弃 pattern 硬约束靠 agent 自治）。
- **启用调度器**（用户在沙箱外执行一次）：`systemctl --user enable --now relic-sync.timer`（无 systemd 则 cron：`*/5 * * * * cd ~/.config/relic && npm run sync >> ~/.relic-sync.log 2>&1`）
- 阶段 2 候选：CI 门禁（GitHub Actions 跑 npm test + round-trip）+ drift 检测；阶段 3 候选：WSL 部署位 symlink 化
- 任何新阶段先调规划 agent 出方案（plan-then-build 硬规则）。

**待澄清**（迁移全落地）：
- ✅ 6 决策点全拍板 + 全执行
- ✅ GAP1+GAP2+GAP4 全修复，Tier1+Tier2+Tier1b PASS，模块忠实化 PASS
- ✅ Wave4 Cutover 执行成功，relic 为唯一治理系统
- ✅ Q1=丢弃 skills（A3 替代），P4 已记录
- ✅ dsh 适配器已完成（路线 A，2026-09-05）
- 第二个目标平台是哪个（Codex/Cursor）？（dsh 是第三个已完成的）
- persona 范畴边界（语气风格？行为偏好？记忆？）——schema 槽位已留，功能待做。
- ✅ 方案详情：地基 output/v1/，方向 3 output/v2/，迁移策略 output/v3/migration-strategy-plan.md。
