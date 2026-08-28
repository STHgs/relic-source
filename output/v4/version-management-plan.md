# Version Management Plan — relic 双仓库 + 自定义本地化

**Version:** v4.0 (version-management)
**Date:** 2026-08-28
**Phase:** Plan-only (READ-ONLY). No edits to source/config/install runtime. Output target: `/mnt/e/AIworkspace/relic/output/v4/version-management-plan.md`.
**Status:** 方案已用户认可并落盘。**此为基线版（baseline）**——用户尚有其他相关问题待讨论，讨论完后一并修订，修订产出 `v4.1`，不覆盖本版。

---

## 1. Executive Summary

**Recommendation (one sentence):** 采用**双轨分离**——`relic-core`（源码）走 GitHub 公开仓 + trunk-based + release tag 供分享；`relic-deploy`（自定义态）走**本地 git**（置于 `/mnt/e/`）+ 本地 tag 快照 + `git bundle` 导出，**不接 GitHub auto-branch**，从根上消灭分支污染。

**Rationale：** auto-branch-to-GitHub 把"版本记录 / 导出 / 再部署"三件事全塞进"每次部署 push 一个 GitHub 分支"，其中只有"异地容灾"是本地 git 做不到的。而用户的 relic-core 已位于 `/mnt/e/AIworkspace/`（Windows 挂载盘，WSL 重置不清理），自定义仓若同样置于 `/mnt/e/`，即**免费获得跨 WSL 重置的存活能力**——GitHub 的唯一真实卖点被现有目录布局覆盖，边际价值归零。`git bundle` 则是"带完整历史地搬走一个仓"的手术刀，离线、单文件、零分支污染，远胜 branch-per-deploy。

**结论：分享源码用 GitHub，记录自定义用本地。** 双轨原则（Twelve-Factor Factor III：代码 vs 状态分离）不变，只是状态轨的存储从 GitHub 改为本地。

---

## 2. Current State（本会话已核实）

| 项 | 现状 | 证据 |
|---|---|---|
| relic 源码仓 | 纯本地 git，**无 remote**，单 `main`，conventional commits，无 tag，源码内**无部署/auto-branch 逻辑** | `git -C /mnt/e/AIworkspace/relic remote -v` 空输出；`git branch -a` 仅 `* main`；`git log` 全 feat/fix/docs |
| 安装目标 `~/.config/opencode/` | **非 git 仓库**；含生成的 `AGENTS.md` + `opencode.jsonc` + `.bak` 安装备份；有独立 `package.json`(86B) | `git -C ~/.config/opencode rev-parse` → fatal:not a git repository |
| auto-branch 触发器 | **不在 relic 源码、不在安装目录、不在 opencode 配置** | `src/orchestrator/generate.mjs` 只做 detect→generate→install（写盘），无 git push/branch 逻辑；`opencode.jsonc` 仅 providers/agents/permissions/MCP，无 hook/command |
| API key | **不在源码**（仅测试占位符 `sk-xxx`/`sk-test-xxx`）；真实 key 仅在安装后的 `opencode.jsonc` | `grep apiKey/sk-/baseURL/llm-center` 命中 `tests/*`、`scripts/tier2-sentinel.mjs` 全为占位符；真实 key 只在 `~/.config/opencode/opencode.jsonc` |

> auto-branch 触发器位置是本方案唯一无法自查的信息——属用户外部脚本（手动 / Windows 侧），需用户在 M4 步告知。这**不影响**方案架构，只影响"重定向"那一步的具体改法。

---

## 3. Why Local for Customization（决策推理）

GitHub 对自定义态的真实增值逐项审计：

| 诉求 | 本地 git 能否满足 | GitHub 额外增值 |
|---|---|---|
| 记录修改 | ✅ commit/diff/blame/时间旅行，全有 | ❌ 零 |
| 导出 | ✅ `git bundle` 单文件带全历史，离线可移植 | ❌ 反而制造分支垃圾（原始痛点） |
| 再部署 | ✅ 新机 `git clone <bundle>` 即恢复 | ⚠️ 仅多"异地存活"一项 |

**GitHub 的唯一真实卖点 = 异地容灾（WSL 重置不丢）。**

而 `/mnt/e/` 是 Windows 挂载盘，WSL 重置不清除它——relic-core 已在此、用户已接受此风险量级。自定义仓同样置于 `/mnt/e/` → **免费获得同等容灾能力**。GitHub 对自定义态的边际价值因此归零，而其成本（auto-push 逻辑维护、分支变乱、网络/账号依赖）是实的。

→ `git bundle` 才是导出的手术刀，GitHub 分支不是。

---

## 4. Topology Target

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  relic-core  (公开·可分享) │        │  relic-deploy (私有·本地)  │
│  源码 + schema + 模块    │        │  仅自定义态 + 安装产物     │
│  trunk-based + release tag│        │  本地 tag 快照（非 branch） │
│  GitHub: public/可 fork   │        │  位于 /mnt/e/（抗 WSL 重置）│
└────────────┬────────────┘        └─────────────┬────────────┘
             │                                    │
             └──────── npm run generate ──────────┘
                   （core 读源 → 写入 deploy 工作树）
```

**关系机制：完全分离，不用 submodule。** 理由：relic-deploy 是个人态，不该嵌进可分享的 core；core-in-deploy 本末倒置。`npm run generate` 本身就是两者间的桥（读 core 的 `policies.yaml`+`modules/`，写到 `~/.config/opencode/` 即 deploy 工作树）。submodule 在此只增耦合无收益。

---

## 5. Boundary Definition（具体到文件）

### relic-core 追踪（源码 / 非自定义）
```
src/   modules/   tests/   scripts/
schema.json   policies.yaml   index.mjs   package.json
.gitignore   AGENTS.md(项目级交接文件)
```
→ 永远走 trunk-based 开发；auto-versioning 绝不碰它。**分享入口。**

### relic-deploy 追踪（自定义 / 安装态）
```
~/.config/opencode/AGENTS.md          ← 生成的治理文件
~/.config/opencode/opencode.jsonc     ← ⚠ 含 API key，必须 gitignore 或脱敏
interaction/   output/                 ← 用户反馈 / 产出（版本化目录）
其它用户本地改动（自定义 module.yaml 覆盖等）
```

### relic-deploy 的 .gitignore（必须配置）
```
opencode.jsonc          # 含明文 key，绝不入库
*.bak.*                 # 安装备份
package.json
package-lock.json
bun.lock
node_modules/
```

---

## 6. Versioning Strategy

### relic-core（源码）：trunk-based + 语义化发版
- `main` 稳定；改动开短命 `feature/<改动名>` → squash merge → 删分支
- **每轮"部署验证改进" = 同一 dev 分支上的多次 commit，不是每次验证建分支**
- 定型后打 tag：`v0.1.0`、`v0.2.0`…（GitHub Release 可附 release notes）
- 分享入口：他人 `git clone` + `npm install` + `npm run generate`

### relic-deploy（自定义态）：本地 tag 快照，不要 branch-per-deploy
- 每次部署 = 打 **annotated tag** `deploy/<timestamp>`（不可变时间点标记，正是 tag 语义）
- 列快照 `git tag -l 'deploy/*'`；回溯 `git describe` / `git checkout <tag>`
- **这一步直接根除"分支变乱"** —— 本地 tag 不占分支、零成本
- 若日后想要连续 log：可改 orphan 分支 `state`（gh-pages 模式，与 core 无共同历史）——可选升级，当前先 tag

---

## 7. Export / Re-deploy via git bundle

```bash
# 导出（一次部署后）
cd /mnt/e/AIworkspace/relic-deploy
git bundle create relic-custom-<ts>.bundle --all

# 再部署（新机 / WSL 重置后）
git clone /path/to/relic-custom-<ts>.bundle relic-state
# 然后把 relic-state 的治理产物同步到 ~/.config/opencode/
```

- 单文件、带全历史、离线、零分支污染、可丢任何存储（U盘/云盘）
- **异地 DR（可选升级）**：按需手动 `git bundle` 丢云盘，或偶尔 push 到私有 remote——手动、低频，**不是每次部署自动 push**

---

## 8. Sharing Flow

**分享时：** relic-core 设为 public（或发 Release 包），不含 key、不含个人态。
**他人接入：**
1. `git clone <relic-core>` → `npm install`
2. `npm run generate` → 治理文件装进他自己的 `~/.config/opencode/`
3. 他自行填 API key（env / 本地 gitignored secrets 文件）
4. 他可选：init 自己的 relic-deploy（或 clone 你附带的初始 bundle 骨架，含治理规则、空 key）

---

## 9. Security（分享前置硬条件）

1. ✅ **已确认**：relic-core 源码无真实 key（grep 仅命中测试占位符）→ 可公开
2. ⚠ **待办**：relic-deploy `.gitignore` 必须排除 `opencode.jsonc`（否则真实 key `sk-2b7e…` 入库即泄）
3. 🎯 **长期推荐**：API key 走环境变量（如 `RELLM_API_KEY`），adapter 从 `process.env` 注入 → 生成的 `opencode.jsonc` 不含明文，即便误提交也不泄。此改动动源码（adapter），列为可选增强项。

---

## 10. Migration Steps（从现状到目标）

| 步 | 动作 | 在哪 | 依赖 |
|---|---|---|---|
| M1 | relic-core 仓设 GitHub remote，推 `main`，打首个 release tag `v0.1.0` | `/mnt/e/AIworkspace/relic` | 无 |
| M2 | 在 `/mnt/e/AIworkspace/` 建 `relic-deploy/` 本地 git 仓，写对 `.gitignore`（排 opencode.jsonc/secrets/备份） | `/mnt/e/AIworkspace/relic-deploy` | 无 |
| M3 | 把 `~/.config/opencode/` 的自定义产物同步进 relic-deploy 工作树（或让 generate 直接写到 relic-deploy 再同步到 ~/.config） | 跨目录 | M2 |
| M4 | 把外部 auto-branch 触发器改为：对本地 relic-deploy 打 tag `deploy/<ts>`（仅 `git add` 自定义路径），**不 push 任何 remote** | **需用户告知触发器位置** | M2,M3 |
| M5 | 验证一轮：改源码 → core dev 分支 commit → generate → deploy 打 tag → 两仓历史互不污染 | 全链路 | M1-M4 |

---

## 11. Open Decision Points（待用户拍板 / 待相关讨论后修订）

1. **auto-branch 触发器现在在哪触发？**（手动脚本？Windows 侧？某命令？）——决定 M4 怎么改。**唯一无法自查项。**
2. **relic-deploy 快照格式**：本地 tag `deploy/<ts>`（推荐，已默认采用）还是日后升级 orphan 分支 `state`？
3. **是否随 relic-core 附带 relic-deploy 初始 bundle 骨架**（含治理规则、空 key）给他人起步？还是让他人从零 init？
4. **API key 方案**：维持现状（deploy 侧 `.gitignore` 兜底）还是改造 adapter 走 env 注入（更彻底，动源码）？
5. **relic-deploy 工作树物理位置**：直接以 `~/.config/opencode/` 为工作树（init git），还是独立 `/mnt/e/AIworkspace/relic-deploy/` + sync？（影响 M2/M3 形态）

> 本节将在用户提出的"其他相关问题"讨论后扩充/修订，产出 v4.1。

---

## 12. Success Criteria

- ✅ relic-core 为唯一 GitHub 仓（public），无个人态、无 key；`npm run generate` 可在干净环境复现治理安装
- ✅ relic-deploy 为本地 git 仓（`/mnt/e/`），`.gitignore` 排除 `opencode.jsonc`/secrets/备份，真实 key 永不入库
- ✅ 每次部署产出本地 tag `deploy/<ts>`，**零新增分支**
- ✅ 两仓历史互不污染：core 仅源码 commit，deploy 仅自定义 snapshot
- ✅ `git bundle` 可单文件导出全历史，新机 `git clone <bundle>` 可恢复
- ✅ 一轮"改源码→generate→部署"验证后，core 与 deploy 的 git log 各自干净、无交叉

---

*End of baseline plan v4.0. 方案已用户认可。待用户提出其他相关问题讨论后，一并修订产出 v4.1，本版保留不覆盖。No edits made to source/config/install runtime.*
