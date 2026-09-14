# 骨架门禁 · 静态骨架等价检查（Tier4）— 计划与实现存档

- 版本：v2（"骨架静态"原则强化版）
- 日期：2026-09-14
- 状态：已实施并验收

## 原则（用户拍板）

1. 骨架是静态的：骨架 = 渲染器的唯一函数，与用户内容无关
2. 用户区提交触碰骨架 = 违法
3. 骨架变更唯一合法路径：renderer + golden 同一提交更新（golden diff 即系统级变更的审查材料）

## 机制

- 探针策略（schema 合法 + PROBE_MARK 撑满所有数据槽）→ render → `tests/fixtures/golden-skeleton.md`
- 骨架行集 = golden 行 − 探针行 − 结构噪声（空行 / `---` / 表分隔 / 哨兵外层围栏对）
- 断言 A（等价）：render(probe) == golden 字节级——拦"改 renderer 不 bump golden"
- 断言 B（不变）：两次 render 的骨架行 hash 一致，除非 golden 同步变更
- 双点部署：sync 内置（generate 前真拦截）+ GitHub CI（HEAD~1 对比，回归信号）
- 状态：`.last-sync` 增记 skeletonSha / goldenSha（部署成功后才落账）

## 边界：CI/sync 守护 vs 用户自由

守护：渲染器行为、骨架段落、哨兵逐字、规则5、索引结构、schema 合法性、体积。
不审：workflow steps / risk items / patterns 的内容与增删（用户主权区，零审查）。

## 验收记录（2026-09-14）

- 280 tests / 278 pass / 0 fail / 2 skip
- 红测1：篡改渲染器哨兵行 → sync 在部署前拒止（gate A FAILED）
- 红测2：纯用户区 risk item 变更 → 放行且骨架 hash 不变
- 首次 CI 运行：success（run 34825193800，2026-09-14）；调通过程修复测试环境依赖（fake HOME + 动态模块副本）
