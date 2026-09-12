# 方案 v4：热插拔部署 + 分支生命周期 + 导出封存

> 生成时间：2026-08-28
> 状态：已批准（用户口令"开始修改"）
> 架构约束：relic 三段式 detect→generate→install 不变，新增 deploy/export 两个 CLI 命令

---

## 1. 问题

relic 删弃了前身的 `install.sh`（含 `ln -s` 软链 + `git clone` 部署语义），但未重建等价的部署操作。缺口：
- 没有部署脚本：relic 本身怎么放到目标位置没人管
- 双副本漂移：`/mnt/e/AIworkspace/relic` 和 `~/.config/relic` 是独立 git clone，互不同步
- skill 缓存失效：install 在 session 运行中执行，OpenCode 不动态刷新 skill 注册表

## 2. 设计目标

**热插拔**，不拘泥单一源：
- 任何 relic 副本都能独立 deploy 到现网
- 每次部署创建一个 git 分支追踪该部署版本的生命周期
- 导出时封存分支，声明生命周期结束
- 跨机器迁移：导出包 → 解压 → `npm install` → `npm run deploy` → 完整复现

## 3. 两个命令

### 3.1 `npm run deploy`（当前副本 → 现网 + git 分支）

```
relic 副本（任意位置）
  │
  ├─ 1. 检测 git remote
  │     ├─ 无 remote → 询问用户
  │     │   ├─ 无仓库 → gh repo create <name> --private，设为 origin
  │     │   └─ 有仓库 → 询问 URL，git remote add origin <url>
  │     └─ 有 remote → 继续
  │
  ├─ 2. 确保 base 分支存在（main），如不在则从当前分支创建
  │
  ├─ 3. 创建 deploy 分支：deploy-<YYYYMMDD>-<n>
  │     n = 同日序号（扫描已有 deploy-<YYYYMMDD>-* 分支 +1）
  │
  ├─ 4. npm run generate（真写现网 + 备份）
  │
  ├─ 5. 清理旧产物（残留 skill 文件等）
  │
  ├─ 6. git add -A && git commit -m "deploy: <YYYYMMDD>-<n>"
  │
  ├─ 7. git push -u origin deploy-<YYYYMMDD>-<n>
  │
  └─ 8. 输出报告 + 提示"重启 session 以刷新 skill 注册表"
```

**首次 deploy 特殊处理**：
- 当前 `~/.config/relic` 在 `master` 分支，只有一个 commit
- 首次 deploy 时：创建 `main` 分支（从当前 HEAD），推送到新 GitHub 仓库
- 后续 deploy 都从 `main` 创建 `deploy-*` 分支

**deploy 报告格式**（stdout JSON）：
```json
{
  "ok": true,
  "branch": "deploy-20260828-1",
  "remote": "origin (https://github.com/STHgs/relic.git)",
  "generate": { "written": [...], "backups": [...] },
  "commit": "abc1234",
  "cleanup": { "removed": ["~/.config/opencode/skill/workflow/SKILL.md", ...] },
  "note": "重启 OpenCode session 以刷新 skill 注册表"
}
```

### 3.2 `npm run export`（当前副本 → 可移植包 + 分支封存）

```
relic 副本（当前在某个 deploy-* 分支上）
  │
  ├─ 1. 确认当前分支（必须是 deploy-* 分支，否则报错）
  │
  ├─ 2. 打包文件清单：
  │     包含：manifest(policies.yaml) + modules/ + src/ + schema.json
  │           + package.json + package-lock.json + scripts/ + tests/
  │           + .gitattributes + .gitignore
  │     排除：node_modules/ / .git/ / generated/ / *.bak.*
  │           / output/ / interaction/
  │
  ├─ 3. 生成 HANDOFF.md 写入包根目录：
  │     - 源分支名 + 最终 commit hash
  │     - "该分支生命周期已结束，封存于此包"
  │     - 导入指引：解压 → npm install → npm run deploy
  │     - 生成时间 + profile 信息
  │
  ├─ 4. 打 tar.gz 到工作区根目录（默认 /mnt/e/AIworkspace/）
  │     文件名：relic-export-<branch>-<short-hash>.tar.gz
  │
  ├─ 5. git tag deploy-<YYYYMMDD>-<n>-archived
  │
  ├─ 6. git push origin <tag>
  │
  └─ 7. 输出报告
```

**HANDOFF.md 格式**：
```markdown
# relic 导出包 — 交接声明

> 本包自 relic deploy 分支封存，生命周期已结束。

## 来源
- 分支：deploy-20260828-1
- 最终 commit：abc1234
- 封存时间：2026-08-28T12:00:00Z
- Profile：full（默认）

## 生命周期声明
该分支生命周期已结束。此包为该部署的完整快照，不再接收更新。

## 导入指引
1. 解压：`tar xzf relic-export-deploy-20260828-1-abc1234.tar.gz`
2. 进入目录：`cd relic-export-deploy-20260828-1-abc1234`
3. 安装依赖：`npm install`
4. 部署到现网：`npm run deploy`
   - 会创建新的 deploy 分支（新生命周期开始）
   - 会询问 GitHub 仓库（如无则自动新建）
```

## 4. 文件清单

### 新增文件

| 路径 | 职责 |
|---|---|
| `scripts/deploy.mjs` | deploy CLI 入口（git remote 检测 + 分支创建 + generate + 清理 + commit + push） |
| `scripts/export.mjs` | export CLI 入口（打包 + HANDOFF.md + tag + push） |
| `src/core/git-ops.mjs` | git 操作封装（branch/commit/push/tag/remote），可测试 |
| `src/core/export-pack.mjs` | 打包逻辑（文件收集 + tar.gz + HANDOFF.md 生成），可测试 |
| `src/core/deploy-lifecycle.mjs` | deploy 分支命名 + 序号计算 + 清理旧产物，可测试 |
| `tests/deploy-lifecycle.test.mjs` | deploy 生命周期测试 |
| `tests/git-ops.test.mjs` | git 操作测试（mock git） |
| `tests/export-pack.test.mjs` | 打包逻辑测试 |

### 修改文件

| 路径 | 改动 |
|---|---|
| `package.json` | scripts 加 `"deploy"` 和 `"export"` |
| `.gitignore` | 加 `*.tar.gz`（导出包不入 git） |
| `AGENTS.md` | §2 进度加本轮成果；§5 文件地图加新文件；§6 交接说明更新 |

## 5. 实施步骤

### Step 1：`src/core/git-ops.mjs`
封装 git 操作（用 child_process.execSync）：
- `hasRemote()` → boolean
- `addRemote(url)`
- `createRepo(name, private)` → 用 `gh repo create` + `git remote add origin`
- `currentBranch()` → string
- `createBranch(name)` / `checkout(name)`
- `commitAll(message)` / `pushBranch(branch)` / `pushTag(tag)`
- `listBranches(pattern)` → string[]（扫描远程分支）
- `createTag(name)`

所有操作在 scratch git repo 中可测试。

### Step 2：`src/core/deploy-lifecycle.mjs`
- `nextDeployBranch(existingBranches, date)` → `deploy-<YYYYMMDD>-<n>`
- `cleanupStaleSkills(home)` → 删除 `~/.config/opencode/skill/` 下的残留 SKILL.md

### Step 3：`src/core/export-pack.mjs`
- `collectFiles(rootDir)` → 返回要打包的文件列表（按清单 include/exclude）
- `writeHandoff(info, destDir)` → 生成 HANDOFF.md
- `pack(sourceDir, destPath)` → tar.gz

### Step 4：`scripts/deploy.mjs`（CLI 入口）
串起 git-ops + deploy-lifecycle + generate：
1. 检测 remote → 引导建仓库
2. 确保 main 分支
3. 创建 deploy 分支
4. 跑 generate（复用 generate.mjs 的 pipeline）
5. 清理旧产物
6. commit + push
7. 输出报告

### Step 5：`scripts/export.mjs`（CLI 入口）
串起 export-pack + git-ops：
1. 确认在 deploy-* 分支
2. 收集文件 + 生成 HANDOFF.md
3. 打 tar.gz
4. tag + push
5. 输出报告

### Step 6：测试
每个新增 .mjs 模块配测试文件，复用现有 scratch-repo 风格（mkdtemp + 真实 git init）。

### Step 7：修改 package.json + .gitignore + AGENTS.md

## 6. 默认值

| 决策 | 默认值 | 理由 |
|---|---|---|
| 分支命名 | `deploy-<YYYYMMDD>-<n>` | 同日多次部署 n 递增 |
| base 分支 | `main` | 与 /mnt/e/AIworkspace/relic 一致 |
| export 后分支处理 | 保留 + 打 tag `deploy-<name>-archived` | 便于追溯，不删历史 |
| HANDOFF.md 位置 | 导出包根目录 | 不污染 relic 自身 AGENTS.md |
| 导出包路径 | `/mnt/e/AIworkspace/` | 与 project-scaffold workflow 一致 |
| GitHub 仓库名 | `relic` | 项目名即仓库名 |
| 仓库可见性 | private | 个人配置系统 |
| 导出包格式 | `.tar.gz` | 跨平台，Linux/Windows 都能解 |

## 7. 约束

- 不改现有 generate.mjs / adapter 代码逻辑
- 不改现有 209 tests（新测试只增不改）
- deploy 脚本用 `child_process.execSync` 调 git/gh，不引入新依赖
- 打包用 Node 内置 `zlib` + `tar`（或纯 JS tar 实现，不引入 archiver 依赖）
- 所有新增代码遵循 .mjs + JSDoc 风格
