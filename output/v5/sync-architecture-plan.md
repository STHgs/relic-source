# relic 单源同步 + roadmap 热加载 · 实施计划

- 版本：v2（含通用性修订）
- 日期：2026-09-12
- 状态：**已执行（2026-09-12）——步骤 0/1/2 全部落地：271 tests 全绿、Tier2 哨兵存活、AGENTS.md 15017B→8688B、DSH 热注入实测成功；细节见 AGENTS.md 交接**
- 前序：v1 计划经用户修订意见（同步机制不做 DSH 特化、强调通用性、DSH 测试不具权威性）形成本版

---

## 0. 背景与问题清单

| # | 问题 | 根因 | 严重度 |
|---|---|---|---|
| P1 | 双库分叉：E 盘源码库（main@ed92591 + 未提交 roadmap 半成品）与 `~/.config/relic` 部署库（8/28 后零提交 + 8 处脏改动 + 未跟踪 dsh.mjs）各自漂移，现网跑的是部署库旧全量渲染器 | 部署位可写、无同步机制、两边都没 push | 🔴 事故根因 |
| P2 | 方向 2（roadmap 渲染）半成品：渲染器改造停在工作区，且有 4 个实现缺口 | 设计未闭环 | 🔴 |
| P3 | 注入文档全量渲染：15KB 常驻、每 session 约 5k+ tokens | 旧渲染器内联全部 steps | 🟡 |
| P4 | 跨平台同步缺失：任一平台提交，其他平台无感知 | 无单源分发机制 | 🔴 主诉求 |
| P5 | session 内热加载：注入层仅 DSH 支持（reconcile 机制，源码已证实），其他平台仅新 session 生效 | 平台特性差异 | 🟡 |
| P6 | 交接纪律失守：交接文档停在 8/30，9/5 晚全部动作无记录 | 违反自身治理规则 | 🟡 |
| P7 | 环境附带发现：Node fetch 单地址连接策略导致多 A/AAAA 站点失败；web_search 插件 401；npm test 在 9p 盘超时 | 环境配置 | 🟢 不阻塞主线 |

## 1. 目标

1. **单源**：GitHub `STHgs/relic` 成为唯一权威源；分叉双库收口，全部历史与半成品无损保留
2. **同步**：任一平台提交 → 各部署平台经宿主调度器周期拉取 → 自动落盘生效
3. **热加载**：AGENTS.md 瘦身为骨架+索引（15KB → 目标 <6KB），workflow 正文触发时现读，全平台生效
4. **防回归**：部署 clone 只读护栏 + 交接文档补课

## 2. 设计原则与架构决策

### 2.1 设计原则（v2 新增，最高优先）

1. **同步机制平台无关**：`relic sync` 只依赖 git + node，任何平台同一命令同一语义；平台差异只允许存在于既有 adapter 层
2. **不对 DSH（或任何单一平台）做特化适配**：不写 DSH 专用钩子、不依赖 DSH 专属行为
3. **测试权威性 = relic 自身测试体系**：验收以 `npm test` + Tier1/Tier2 harness 为准（平台中立）；任何单平台观察（含 DSH 热注入）只作冒烟参考，不作为验收标准
4. DSH 的指令热重载是**平台赠品**：观察到、记录之，不依赖、不验收

### 2.2 决策点（默认拍板，随批准生效）

| # | 决策 | 结论 |
|---|---|---|
| Q1 | 唯一权威源 | GitHub private（`github.com/STHgs/relic`） |
| Q2 | 部署副本策略 | 只读 clone + 防护钩子 |
| Q3 | sync 觐发 | 宿主调度器（systemd timer / cron / Task Scheduler / launchd），每 5 分钟 |
| Q4 | CI 门禁 | 阶段 2 另行计划，本计划不含 |
| Q5 | 生成产物是否入库 | 否（拉取时本地 generate） |
| Q6 | roadmap 渲染 | 进阶段 1（热加载目标的必要组件） |

### 2.3 拓扑

```
权威源：GitHub STHgs/relic
  ├── 开发位：~/.config/relic（ext4 dev clone，测试与开发都在此，9p 不跑测试）
  ├── 部署位（各平台）：clone + `relic sync` 周期拉取
  │     └── 产物由各平台 adapter 本地 generate 后写入部署点（产物不入库）
  └── E 盘库：归档/普通 clone（9p 慢，不再承担开发）
```

## 3. 步骤 0 · 双库收口（6 个提交）

| # | 动作 | 验证 | 风险与回滚 |
|---|---|---|---|
| 0.1 | E 盘库：未提交的 roadmap 渲染器 + 3 测试文件提交为 `feat/roadmap-renderer-wip`（原样保留半成品，不修） | 分支可见 | 纯新增，无风险 |
| 0.2 | E 盘库：`git remote add origin` → push main + wip 分支 | GitHub 两分支可见 | push 认证可能弹窗；失败需用户提供 PAT |
| 0.3 | 部署库：脏改动（含未跟踪 dsh.mjs）整体提交为 `feat/dsh-adapter` 并 push | 分支可见 | 提交前 stash 留档 |
| 0.4 | dev clone 合并两分支：先 `feat/dsh-adapter`（renderer 以部署版全量渲染器为基线），再 `feat/roadmap-renderer-wip`（以骨架+索引版为胜）；**唯一高风险检查点** | `npm test` 全绿（仅 ext4） | 冲突解错 → `git merge --abort`；两分支独立合并、独立验证 |
| 0.5 | main 上 `npm run generate` + install，重写 `~/.dsh/AGENTS.md` 与 opencode 配置（relic 自带 backup） | **Tier2 哨兵 harness 全存活**；两平台产物一致 | backups/*.bak 可回滚 |
| 0.6 | 两旧库归位为 main 干净 clone；历史分支保留 | 两库 `git status` 干净 | 0.2/0.3 已 push，无损 |

## 4. 步骤 1 · 同步机制

| # | 动作 | 细节 |
|---|---|---|
| 1.1 | `scripts/sync.mjs`（`npm run sync`）——通用原语 | `git pull --ff-only` → `npm run generate`（走既有 adapter，各平台各自渲染）→ install → Tier2 哨兵自检 → 写 `.last-sync`；工作区脏/非 ff 即报错拒绝，绝不静默调和。零平台假设 |
| 1.2 | 宿主调度器接入（通用化）：Linux/WSL = systemd user timer 或 cron；Windows = Task Scheduler；macOS = launchd。仓库提供 sync 命令 + 各平台接入文档；可选 `scripts/install-schedule.mjs`（探测宿主 → 生成对应调度配置），本身也是平台通用工具 | 明确删除项：`.bashrc` 包裹 dsh 的启动钩子（DSH 特化，不采纳） |
| 1.3 | 新鲜度由调度器保证；离线唤醒靠手动 `relic sync`（幂等，秒级） | 删除项：dsh 启动补跑（同上） |
| 1.4 | 只读护栏：部署 clone pre-commit hook 拒绝本地提交（提示"请在 dev clone 开发"）+ `.relic-deploy` 标记文件缺失时 sync 拒绝运行 | 纯 repo 级机制，平台中立 |

## 5. 步骤 2 · roadmap 渲染补完（四缺口）

| # | 缺口 | 改动 |
|---|---|---|
| 2.1 | workflow→模块溯源丢失 | `module-loader.mjs` mergeFragments 给每条 workflow/risk 项标注 `_sourceModule` |
| 2.2 | 运行时寻址未定义 | 索引表路径 = adapter 在本平台 generate 时注入的 runtime clone 绝对路径（如 `~/.config/relic/modules/<m>/module.yaml`）。每个平台的 sync 本地跑 generate，路径各自正确——既有 adapter 逐平台渲染模式的正常运用，非 DSH 特化 |
| 2.3 | inline 入口流程指向落空 | add-permission/add-workflow 指向 policies.yaml（同 2.2 注入路径） |
| 2.4 | 缺触发即读元规则 | "给助手的话"新增第 5 条：执行任何流程前必须先 Read 索引表指向的正文文件 |

保留决策：风险分级（紧凑版）留骨架；硬约束表/subagent 提示/哨兵全留骨架；workflow steps 全部移出注入文档。

验证（权威）：测试套件断言索引路径存在性（对生成 FileMap 断言）、骨架保留完整性、round-trip 无损；目标体积 <6KB。DSH 上"新 session 变瘦"仅冒烟参考，不写入验收标准。

## 6. 步骤 3 · 收尾

1. 交接文档 `relic/AGENTS.md` 补记：双库漂移事故、Q1-Q6 拍板结果、新工作流（改规则 → commit → push → 周期内全域生效）
2. 本计划存档（即本文件）
3. **新增 Tier3 同步语义测试** `tests/sync.test.mjs`：scratch 目录内构造并断言——远端新增提交 → sync 拉取 → 产物更新 → 哨兵存活；本地脏 → sync 拒绝；非 ff → sync 拒绝。纯 git+文件系统，零平台依赖
4. 最终全量验证（L1+L2+L3）+ 提交 push

## 7. 验证体系分层（权威顺序）

| 层级 | 手段 | 权威性 |
|---|---|---|
| L1 单元/回归 | `npm test`（仅 ext4） | ✅ 权威 |
| L2 平台等价 | Tier1 等价 + Tier2 哨兵 harness | ✅ 权威 |
| L3 同步语义 | Tier3 sync.test.mjs（新增） | ✅ 权威 |
| L4 单平台观察 | 如 DSH 新 session 加载瘦身 AGENTS.md、热注入表现 | ⚠️ 仅冒烟参考，不作数 |

## 8. 执行顺序与依赖

```
0.1→0.2→0.3→0.4→0.5→0.6 → 1.1→1.2/1.4(并行) → 2.1→2.2→2.3→2.4→测试 → 3
                        └─ 0.4 唯一高风险点（冲突解决），单独设检查点
```

## 9. 风险与回滚总表

| 风险 | 缓解 |
|---|---|
| 合并冲突解错 | 分支独立合并、独立验证；`git merge --abort` |
| 产物回归（AGENTS.md 异常） | Tier2 哨兵 + 体积断言；backups/*.bak 回滚 |
| push 认证失败 | 用户提供 PAT；本地分支无损 |
| WSL 无 systemd | 降级 cron（调度器仅是接入方式，sync 原语不受影响） |
| 9p 上测试超时 | 一切测试限定 ext4 dev clone（已列入设计原则） |

## 10. 不做的事

- 不写任何 DSH 专属钩子/包装/配置
- 不把 DSH 行为写进任何验收标准
- 不在 DSH 会话内跑权威测试
- 不动 DSH 自身代码
- 不上 CI（阶段 2 另行计划）、不做 symlink 化（阶段 3 可选）
- 不删除任何历史分支/备份
