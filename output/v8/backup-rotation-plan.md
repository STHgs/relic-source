# v8 — 备份冗余治理方案（A1 源头比对 + B1 历史去重）

## 背景

relic sync 每 5 分钟跑一次 generate（真写 AGENTS.md），install 前无条件 `backup()` → 即使内容零变更也产生 `.bak.<ts>`。WSL 端实测：opencode 360 个 / dsh 344 个 / 共 8.4 MB，绝大多数是冗余副本（`.last-sync` 显示 `pulled:false` 但仍 backup+write）。Win 端同机制，用户报告持续累积。

根因：`src/adapters/base.mjs:65-72` 的 `backup()` 只检查文件存在，不比较内容；`opencode.mjs:52` / `dsh.mjs:50` 的 install 无条件调 `backup()` 再 write。

## 方案

### A1 — 源头比对跳过（install 层）

install 写入前比对"当前文件内容 == 即将写入的内容"；相同则跳过整个 install 步骤（不 backup、不 write，`skipped.push('<id> (unchanged)')`）。

改动：
- `src/adapters/base.mjs`：新增 `isContentUnchanged(absPath, newContent)` helper（readFileSync + 严格相等比较；文件不存在返回 false）
- `src/adapters/opencode.mjs`：install 开头加比对短路（AGENTS.md 专用；opencode.jsonc 不动——route A 不再写它）
- `src/adapters/dsh.mjs`：install 开头加比对短路

不碰 renderer → 不需要 bump golden。

### B1 — 历史残留去重脚本

新增 `scripts/cleanup-backups.mjs`：扫描指定路径的 `.bak.*`，按内容 sha256 去重（相邻相同只留最新一个），保留最近 N 个唯一变更点，删其余。幂等。

- 默认扫描 relic 写的 4 个路径（opencode AGENTS.md + dsh AGENTS.md + 两个 omo 路径——虽然 omo 现是 no-op 但保留兼容）
- `--keep N`：保留变更点数，默认 10
- `--dry-run`：只报告不删
- `--path <p>`：自定义扫描路径

## 决策

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| Q1 | 源头治用 A1 还是 A2（仅 rotation） | A1 | 治本——从源头消除冗余；回滚语义更准（每个 .bak 都是真实变更点） |
| Q2 | 历史残留用 B1（脚本去重）还是 B2（一把清） | B1 | 保留真实变更点 audit trail，不丢历史 |
| Q3 | rotation 上限 N | 10 | AGENTS.md 变更不频繁，10 个变更点够覆盖近期回滚需求 |
| Q4 | cleanup-backups.mjs 入 git | 入库 | maintenance 工具，按需手动跑，复用价值高 |

## 影响面

- **不改 install 对外契约**：`InstallReport` 结构不变，`skipped` 数组多一种 reason `'unchanged'`
- **不改 renderer**：不需要 bump golden
- **不改 sync-core / skeleton**：install 行为变化对 sync-core 透明（它只看 `gen.written`/`gen.errors`）
- **现有测试**：`adapters.test.mjs` 的 install 断言需检查——fake home 写的是全新文件（不存在），所以 `isContentUnchanged` 返回 false，现有"written"断言不破。仅新增 unchanged 用例。
- **Tier2 sentinel**：`tier2-sentinel.mjs` 用 fakehome 首次写入，`isContentUnchanged` 返回 false（文件不存在），不破。

## 验证

- `npm test`：0 fail（新增测试全绿，现有测试不破）
- `node scripts/tier4-skeleton.mjs`：PASS（未碰 renderer）
- 手动跑 `node scripts/cleanup-backups.mjs --dry-run`：扫描现网 704 个 .bak，报告去重后保留数
- 手动跑 `npm run sync`（dryRun 模拟）：验证内容未变时 skipped 含 'unchanged'

## 改动清单

| 文件 | 改动 |
|---|---|
| `src/adapters/base.mjs` | +`isContentUnchanged()` |
| `src/adapters/opencode.mjs` | install 加 unchanged 短路 |
| `src/adapters/dsh.mjs` | install 加 unchanged 短路 |
| `scripts/cleanup-backups.mjs` | 新增 |
| `tests/base.test.mjs` | +isContentUnchanged 测试 |
| `tests/adapters.test.mjs` | +opencode/dsh unchanged→skip 测试 |
| `tests/cleanup-backups.test.mjs` | 新增 |
| `package.json` | +cleanup-backups 脚本入口 |
| `AGENTS.md` | §2 + §6 更新 |
