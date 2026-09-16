# relic

跨平台个人 agent 治理系统：一套规则与人设，治理你所有的 AI 编程助手。

```
relic-source（本仓库）      治理引擎：渲染器 / 骨架门禁 / 同步机制 / 平台适配器
        │
relic-sync（你的私有库）    你的内容：规则模块 / 人设 / 工作流（每配置身份一个库）
        │
   各平台的 AGENTS.md        DSH · OpenCode/OMO · （已退役：Claude Code）
```

治理哲学：**纯提示词治理**——所有约束全量渲染进各平台读的 AGENTS.md，agent 自律执行（deny 级无例外、中高风险发起前显式声明），文件系统层由各平台原生沙箱兜底。引擎静态骨架由 golden 门禁守护，内容区（modules/personas/workflows）零审查、自由修改、5 分钟全域热生效。

## 快速开始（任一平台三行）

前置：`node ≥ 20`、`git`、[GitHub CLI](https://cli.github.com)（Windows 用 winget 装，见下）

```bash
git clone https://github.com/STHgs/relic-source.git
cd relic-source
npm run bootstrap
```

bootstrap 自动完成：环境自检 → 内容库接入（新身份自动建私有库 / 老身份 clone）→ 依赖安装 → 首次部署（骨架门禁 + 写各平台 AGENTS.md + 哨兵校验）→ 调度器安装（每 5 分钟自动同步）。

---

# Windows 部署指南（治理 Windows 端 DSH 等）

以下为 Windows 原生环境的完整通用步骤（PowerShell 执行）。

## 1. 安装前置三件套

```powershell
# 逐项检查，已装可跳过
node -v      # ≥ 20；缺失：winget install OpenJS.NodeJS.LTS
git --version    # 缺失：winget install Git.Git
gh --version     # 缺失：winget install GitHub.cli
```

装完**重开 PowerShell** 让 PATH 生效。

## 2. GitHub 认证（一次性）

```powershell
gh auth login            # 选 GitHub.com → HTTPS → Login with a web browser，按设备码完成
gh auth refresh -h github.com -s workflow   # 补 workflow scope（后续推送引擎更新需要）
```

## 3. 一键部署

```powershell
git clone https://github.com/STHgs/relic-source.git
cd relic-source
npm run bootstrap
```

交互点（仅两处，设计内）：

| 提示 | 选择 |
|---|---|
| 未发现身份内容库 | **新用户**选 `1`（自动创建私有同步库，从 template 种子开始）；**接入已有身份**选 `2` 并填同步库 URL（如 `https://github.com/<you>/relic-sync.git`） |
| gh 授权 | 若第 2 步已做，此处自动跳过 |

自动执行链：clone 同步库到 `~\.config\relic-sync` → `npm install` → 首次 `npm run sync`（探测到 `%USERPROFILE%\.dsh` 等平台 → 写入各自 `AGENTS.md`，含哨兵与门禁）→ `schtasks` 调度器注册 → 输出部署报告。

## 4. 验证

```powershell
# 治理文本已写入 win 端 DSH（预期计数 ≥2）
(Select-String -Path "$env:USERPROFILE\.dsh\AGENTS.md" -Pattern "助手人设","治理约束").Count

# 引擎版本锁定（与你的其他机器一致）
Get-Content ~\.config\relic-sync\engine.lock

# 每 5 分钟自动同步任务在列
schtasks /Query /TN relic-sync
```

验证通过后，新开 DSH session 即受治理（认标志：输出首行 `RELIC IS RUNNING @ 时间戳`）。

## 5. 日常使用

```powershell
# 改规则/人设：编辑同步库内容后提交推送，5 分钟内所有平台热生效
notepad ~\.config\relic-sync\policies.yaml     # personas 段 = 工作习惯
cd ~\.config\relic-sync; git add -A; git commit -m "update rules"; git push

# 手动立即同步（不想等 5 分钟）
cd relic-source; npm run sync

# 引擎升级（新平台适配/骨架演进后）
npm run upgrade -- --tag <tag>
```

## 故障排查

| 症状 | 处置 |
|---|---|
| schtasks 注册失败 | 管理员 PowerShell 重跑；或手动 `schtasks /Create /TN relic-sync /SC MINUTE /MO 5 /TR "cmd /c cd /d <repo绝对路径> && npm run sync"` |
| sync 报 `内容库不存在` | 手动 `git clone <同步库URL> ~\.config\relic-sync` 后重跑 bootstrap |
| push 被拒（scope） | `gh auth refresh -h github.com -s repo,workflow` |
| npm install 慢 | `npm config set registry https://registry.npmmirror.com` |
| DSH 开 session 无治理标志 | 确认 win 端 dsh 实际读取路径是否为 `%USERPROFILE%\.dsh\AGENTS.md`；不同则到本仓库提 issue 收敛 `src/core/paths.mjs` |

## 其他平台

- **Linux / WSL**：同"快速开始"三行；调度器自动选 systemd（或 cron 回退）
- **macOS**：同上；调度器自动选 launchd（`~/Library/LaunchAgents/dev.relic.sync.plist`）
- **接入新 harness**：读标准位置（`.dsh`/`.config/opencode`）零配置；自定义位置加 route A 适配器（模板 `src/adapters/dsh.mjs`，约 60 行）

## 更多文档

- `docs/SYNC.md` — 同步机制 / 骨架门禁（golden 仪式）/ 各平台调度器 / Windows 适配说明
- `AGENTS.md` — 引擎开发交接（决策史 / 架构 / 下轮方向）
- `output/v1–v7` — 七份里程碑方案存档
