# relic

> 名称取自《赛博朋克 2077》中的 relic 生物芯片——一枚让意识和习惯跨越载体存续的植入物。

## 为什么做 relic

AI 工具正在爆发式发展，每天都有新产品涌现。但对个人使用者来说，**切换平台意味着重新配置一切**——权限规则、工作习惯、常用流程都要从头再来，耗时费神。多平台用户的处境更糟：不同平台的 AI 各自为政、记忆互不相通，使用体验割裂，手动维护同步又极其费力。

relic 的愿景：**帮助用户长期维护一个符合自己使用习惯的工作伙伴**——你调教一次，它跟随你到任何平台。

## 它是怎么工作的

```
relic-source（本仓库）      治理引擎：渲染器 / 骨架门禁 / 同步机制 / 平台适配器
        │
relic-sync（你的私有库）    你的内容：规则模块 / 人设 / 工作流（每配置身份一个库）
        │
   各平台的 AGENTS.md        DSH · OpenCode/OMO · Codex（CLI/IDE/Desktop 全线）
```

核心机制：**纯提示词治理**——你的全部规则与人设被编译成各平台读的 AGENTS.md，agent 自律执行（deny 级无例外、中高风险发起前显式声明）。主要能力：

- **一套身份，多平台生效** —— 改一次规则，5 分钟内所有已部署平台热更新
- **自定义安装路径自动发现** —— 四层解析链（声明 > 环境变量 > 官方配置 > 约定路径）
- **全生命周期管理** —— GUI 安装向导 / 升级 / 按平台选择性卸载 / 一键恢复治理
- **学习与适应** —— agent 观察你的偏好并持久化，说"记住"即可晋升为全域规则
- **骨架门禁** —— 引擎渲染器有 golden 基线守护，内容区（modules/personas/workflows）零审查、自由修改
- **同步库默认 Gitee** —— 大陆可达性优先，GitHub 备选

## 快速开始（推荐：GUI 安装向导）

### Windows —— 双击即装

从 [GitHub 仓库页](https://github.com/STHgs/relic-source)（或 [Gitee 镜像](https://gitee.com/sthgs/relic-source)）下载 **`relic-setup.cmd`**，双击运行：

```
自动安装 Node.js + Git（winget）→ 下载引擎 → 打开浏览器向导
    → 环境检查 → 选身份（Gitee 新建 / 接入已有）→ 粘贴令牌
    → 实时进度 → 完成报告（治理已部署 + 调度器已注册）
```

已装过前置依赖的用户也可以跳过引导：

```powershell
git clone https://gitee.com/sthgs/relic-source.git
cd relic-source
npm run wizard        # 浏览器自动打开 http://localhost:17777
```

### Linux / WSL / macOS

```bash
git clone https://github.com/STHgs/relic-source.git
cd relic-source
./install.sh          # 启动同一套浏览器向导
```

### 命令行安装（备选，适合脚本化/CI）

```bash
git clone https://github.com/STHgs/relic-source.git
cd relic-source
npm run bootstrap
```

bootstrap 自动完成：环境自检 → 内容库接入（新身份自动建私有库 / 老身份 clone）→ 依赖安装 → 首次部署（骨架门禁 + 写各平台 AGENTS.md + 哨兵校验）→ 调度器安装（每 5 分钟自动同步）。

### 向导的日常管理（已部署用户）

`npm run wizard` 打开后自动检测部署状态，提供三 Tab：

| Tab | 功能 |
|---|---|
| **恢复治理** | 去治理后一键恢复（备份还原 + sync 兜底） |
| **升级** | 检查新版本 → 测试门禁 → 重新部署 → 更新 engine.lock |
| **卸载** | 三级：去治理（秒级可恢复）/ 停服务 / 完全卸载；支持按平台选择性移除 |

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
| 未发现身份内容库 | **新用户**选 `1`（在 Gitee 自动创建私有同步库——提示粘贴私人令牌一次，令牌页见第 2 步说明）；**接入已有身份**选 `2` 并填同步库 URL（如 `https://gitee.com/<you>/relic-sync.git`） |
| Gitee 令牌 | 选 `1` 时：到 gitee.com → 设置 → 安全设置 → 私人令牌 → 生成（勾选 projects）→ 粘贴一次 |

> 托管平台说明：**同步库默认 Gitee**（大陆可达性优先，2026-09-29 起）；`--provider github` 可切回 GitHub（需 gh CLI 设备码授权）。引擎库（本仓库）仍在 GitHub（CI 门禁依赖）。

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
| harness 自定义安装路径 relic 找不到 | 三层自救（按序）：①内容库放 `harness-paths.json` 声明实际路径（最高优先，示例见 relic-sync 的 `harness-paths.example.json`）②设官方 env：`DSH_HOME` / `OPENCODE_CONFIG` / `XDG_CONFIG_HOME`（系统级）③默认安装路径无需任何配置 |

## 其他平台

- **Linux / WSL**：同"快速开始"三行；调度器自动选 systemd（或 cron 回退）
- **macOS**：同上；调度器自动选 launchd（`~/Library/LaunchAgents/dev.relic.sync.plist`）
- **接入新 harness**：读标准位置（`.dsh`/`.config/opencode`）零配置；自定义位置加 route A 适配器（模板 `src/adapters/dsh.mjs`，约 60 行）

## 更多文档

- `docs/SYNC.md` — 同步机制 / 骨架门禁（golden 仪式）/ 各平台调度器 / Windows 适配说明
- `AGENTS.md` — 引擎开发交接（决策史 / 架构 / 下轮方向）
- `output/v1–v7` — 七份里程碑方案存档
