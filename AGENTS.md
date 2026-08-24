# relic — 项目交接文件

> 跨 session/平台交接文件。任何 agent 进入本项目时必须先读取此文件再执行任务。
> 每轮 session 结束前（含中断退出）必须更新「当前进度」和「交接说明」区块。只写事实，不写推测。

## 1. 任务目标

- relic 是可插拔、可跨平台移植的个人 agent 配置系统：规则（rules）、工作流（workflows）、人设/性格（persona/personality）等以统一源维护、可长期演进，并随用户迁移到不同平台（OpenCode、Claude Code、Codex、Cursor 等）而无需从零重配。
- relic 是对现有 agent-governance 项目（~/.config/opencode/agent-governance/，git 仓库）的优化与扩展。agent-governance 现仅支持 OpenCode：以 policies.yaml 为唯一事实源，经 generate.mjs 生成 ~/.config/opencode/AGENTS.md 供运行时权限拦截使用。
- 命名来源：赛博朋克 2077 中承载 Johnny Silverhand 人格印记（engram）的 Relic 芯片——寓意"人格/人设封装在可移植载体中随身携带"。

## 2. 当前进度

- [x] 项目脚手架建成：/mnt/e/AIworkspace/relic（AGENTS.md、interaction/、output/）
- [x] git 仓库初始化（原子提交：结构 + 本文件）
- [ ] 架构设计（下一 session 任务，见「交接说明」）
- [ ] 首个可运行能力（待架构设计确定）

## 3. 关键决策

- 结论：脚手架保持最小化，仅含标准结构（AGENTS.md + interaction/ + output/ + git 基础文件），不预建 src/ 等架构目录。理由：目录结构应由架构设计产出，避免推测性结构返工。
- 结论：git init 在脚手架阶段即执行（分支 main）。理由：前身项目即 git 仓库，从第 0 号提交开始留痕，脚手架提交即为可回滚基线。
- 结论：output/ 初始为空（无 v1）。理由：版本目录在有产物时才创建，禁止空版本。
- 结论：仓库添加 .gitattributes 固定 LF 换行。理由：仓库位于 Windows 挂载盘（/mnt/e），防 WSL/Windows 工具链换行符漂移。
- 结论：开发期间不改动 ~/.config/opencode/agent-governance/ 现网配置。理由：它是当前 OpenCode 运行时治理的生效来源，迁移需待架构设计后专项决策。

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
- 按已批准方案创建项目脚手架（目录 + AGENTS.md + git 初始化与 2 个原子提交），未写任何功能代码，未触碰 agent-governance 现网配置。

**下轮该做**：
- 架构设计 session：明确 relic 的源格式（policies.yaml 演进 or 新格式）、多平台生成器目标（第一平台 OpenCode，第二平台选型待定）、rules/workflows/persona 的建模与组件划分、对 agent-governance 的复用 vs 重写边界。产出设计文档入 output/v1/。建议 TDD：先定 schema 与校验测试，再写生成器代码。

**待澄清**：
- 迁移策略：relic 成熟后是原地替换 agent-governance、软链过渡，还是长期共存？
- 第二个目标平台是哪个（Claude Code / Codex / Cursor）？
- persona/人设的范畴边界（语气风格？行为偏好？记忆？）？
- agent-governance 中的 skills/（workflow、permission）是否随迁入 relic？
- output/ 版本产物是否纳入 git 跟踪（当前默认跟踪）？
