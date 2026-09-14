# relic 同步机制（sync）

## 语义

`npm run sync` 在任意 clone 内执行：

```
git status --porcelain   # 脏 → 拒绝（绝不静默 stash）
git fetch origin main
git merge --ff-only      # 分叉 → 拒绝（绝不 force）
npm run generate         # 各平台适配器本地渲染 + install（自带 backup）
哨兵自检                  # 每个写出的 AGENTS.md 必含 RELIC IS RUNNING
写 .last-sync            # { time, commit, pulled }
```

退出码 0=成功，1=失败（stdout/stderr 人类可读）。

## 角色

| 角色 | 标记 | 行为 |
|---|---|---|
| dev clone（开发位） | 无 `.relic-deploy` | 可提交可推送；跑测试 |
| deploy clone（部署位） | `.relic-deploy` + pre-commit 护栏 | 只 pull，本地提交被 hook 拒绝 |

把当前 clone 初始化为部署位：`npm run sync -- --init-deploy`

## 宿主调度器接入（平台无关原语 + 各平台定时器）

### Linux / WSL（systemd user timer）

`~/.config/systemd/user/relic-sync.service`:
```
[Unit]
Description=relic sync

[Service]
Type=oneshot
WorkingDirectory=<clone 路径>
ExecStart=/usr/bin/env npm run sync
```

`~/.config/systemd/user/relic-sync.timer`:
```
[Unit]
Description=relic sync every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

启用：`systemctl --user enable --now relic-sync.timer`

### Linux / WSL（cron，无 systemd 时）

```
*/5 * * * * cd <clone 路径> && npm run sync >> ~/.relic-sync.log 2>&1
```

### Windows 原生（Task Scheduler）

```
schtasks /Create /TN "relic-sync" /SC MINUTE /MO 5 /TR "cmd /c cd /d <clone> && npm run sync"
```

### macOS（launchd）

`~/Library/LaunchAgents/dev.relic.sync.plist`：`StartInterval=300`，`ProgramArguments` 指向 `<clone>/scripts/sync.mjs` 的 node 进程。

## 一致性说明

- 生成产物不入库（Q5）：每次 sync 在本地 generate，产物 = 派生物
- 测试权威性（v5 计划原则 3）：验收以 `npm test`（L1）+ Tier1/2（L2）+ Tier3 sync.test（L3）为准；单平台行为（如 DSH 热注入）仅为冒烟参考

## 骨架门禁（Tier4，2026-09-14）

`npm run sync` 在 generate 之前运行骨架门禁；GitHub CI 在 push 后独立复核：

- **断言 A（等价）**：`render(探针策略) === tests/fixtures/golden-skeleton.md`（字节级）。
  拦截"改了渲染器但没 bump golden"的非法系统变更。
- **断言 B（不变）**：本次渲染的骨架行 hash 与 `.last-sync` 记录一致；不一致且 golden 未变 → 拒绝部署。
  拦截用户区提交（modules/policies 内容）导致的骨架侵蚀。

**系统变更的合法仪式**：改 `src/render/agents-md.mjs` 的同一提交里运行
`npm run check:skeleton -- --bump-golden` 并提交更新后的 golden——golden 的 diff 就是审查材料。

**边界**：门禁只守护骨架（结构/哨兵/固定话术/索引格式）；workflow steps、risk items、
permission patterns 属用户主权区，零审查。
