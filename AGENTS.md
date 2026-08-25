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
- [ ] 地基实施：方案已向用户展示，待批准 F1（是否丢弃 hook 枚举）+ go 开干
- [ ] 人设功能 / Codex/Cursor 适配器 / 模块化系统（地基之后）

## 3. 关键决策

- 结论：脚手架保持最小化，仅含标准结构（AGENTS.md + interaction/ + output/ + git 基础文件），不预建 src/ 等架构目录。理由：目录结构应由架构设计产出，避免推测性结构返工。
- 结论：git init 在脚手架阶段即执行（分支 main）。理由：前身项目即 git 仓库，从第 0 号提交开始留痕，脚手架提交即为可回滚基线。
- 结论：output/ 初始为空（无 v1）。理由：版本目录在有产物时才创建，禁止空版本。
- 结论：仓库添加 .gitattributes 固定 LF 换行。理由：仓库位于 Windows 挂载盘（/mnt/e），防 WSL/Windows 工具链换行符漂移。
- 结论：开发期间不改动 ~/.config/opencode/agent-governance/ 现网配置。理由：它是当前 OpenCode 运行时治理的生效来源，迁移需待架构设计后专项决策。
- 结论：地基先行（schema v2 权威 + ajv 自动检具 + 平台适配器快换夹头），人设/Codex/Cursor/模块化延后。理由：地基晃则配件松，先固地基再装配件。
- 结论：relic 重新实现前身概念，不拷贝前身文件打补丁。理由：避免带入前身 bug，且新结构干净。
- 结论：本阶段不引入 TypeScript，沿用前身 .mjs + JSDoc 工具链。理由：不增编译步骤，迭代快；TS 迁移记为未来选项。

## 4. 已知约束

- 写 /mnt/e（Windows 盘）属复杂任务，必须先出方案并获用户批准（plan-then-build），批准词如 build/实施/开始改/go。
- 本文件全文 ≤200 行，只写事实不写推测；每轮 session 结束前必须更新「当前进度」与「交接说明」。
- output/ 内产物按版本号独立存放（大改 v1/v2/v3，小改 v1.1/v1.2），禁止覆盖旧版本；新版本 = 复制上一版本 + 修改；原版本有缺陷时在本文件标注缺陷与修复版本号，不删除原版本。
- 打包产物（如 zip）放工作区根目录 /mnt/e/AIworkspace/ 下，与本项目主文件夹平级。
- 用户输入与反馈材料（截图、需求、bug 反馈）保存进 interaction/；处理用户反馈时先 `ls -lt` 查看该文件夹最新文件。

## 5. 文件地图

- AGENTS.md — 本文件，跨 session/平台交接文件
- interaction/ — 用户输入与反馈材料；初始为空
- output/ — agent 产物，按版本独立存放；初始为空（尚无 v1）
- .gitignore / .gitattributes — git 基础配置
- （前身项目，只读参考，未迁移）~/.config/opencode/agent-governance/ — policies.yaml、schema.json、generate.mjs、lib/、install.sh、rollback-plan-then-build.sh、generated/、backups/、skills/

## 6. 交接说明

**上轮做了**：
- 建成 relic 脚手架（目录 + AGENTS.md + git main 2 提交），未写功能代码，未碰现网 agent-governance。
- 读完 agent-governance 全部源码（policies.yaml/schema.json/generate.mjs/install.sh/lib 两文件/skills 两文件/README），产出差距分析：4 支柱缺口（可插拔/跨平台/长期演进/persona）+ 3 个前身 bug（/permission 加 bash 规则静默失败、hook 死代码、schema 非权威）。
- 调规划 agent 产出地基实施方案（8m46s 决策完备）：11 任务 5 波次——schema.json v2（含 personas/modules 槽位、删 hook 枚举）、validator(ajv)、loader、permission-map、conflict、inject、agents-md 渲染器、3 平台适配器(opencode/omo/claude)、orchestrator、index.mjs、TDD 测试套件、AGENTS.md 更新。3 bug 在重写中修复。
- 用工科通用语言向用户解释了整个地基方案架构。

**下轮该做**：
- 等用户对 F1 拍板（丢弃 hook 枚举？规划推荐丢弃）+ go 信号。
- 执行地基 W1→W5：W1 package.json+schema+fixtures → W2 validator/loader/conflict/agents-md/adapter-base → W3 三适配器+inject → W4 orchestrator+index → W5 AGENTS.md 更新+提交。每波次间跑 `node --test` 验证，失败即停。
- 地基完成后再谈：人设功能、Codex/Cursor 适配器、模块/pack 系统。

**待澄清**：
- F1（主线，待用户拍板）：是否丢弃 enforcement:hook 枚举？规划推荐丢弃（死代码、只支持 block、deny 已可由 runtime+deny 表达）。
- F2（次要）：bash 规则是否必须带 patterns（保留前身语义）？默认保留。
- F3（次要）：Claude 全局安装路径 ~/.claude/AGENTS.md？默认是。
- 迁移策略：relic 成熟后是原地替换 agent-governance、软链过渡，还是长期共存？
- 第二个目标平台是哪个（Codex/Cursor，地基之后做）？
- persona 范畴边界（语气风格？行为偏好？记忆？）——地基只留 schema 槽位。
- agent-governance 中的 skills/（workflow、permission）是否随迁入 relic？
- output/ 版本产物是否纳入 git 跟踪（当前默认跟踪）？
- ⚠ 地基方案完整 11 任务详情在本 session 对话里，未落盘成文件。下 session 若要直接续建，建议先把它存到 relic/output/v1/foundation-plan.md（待用户指示）。
