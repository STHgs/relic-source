# 引擎/内容拆分 · 实施存档（v7）

- 日期：2026-09-15
- 状态：已实施并验证（端到端 sync 绿、bootstrap 冒烟绿、热注入实测）

## 架构

- **relic-source（静态权威源）**：引擎源码 + template/ + golden + 门禁 + CI；持续开发；骨架演进在此发生（golden bump 仪式）
- **relic-sync（每配置身份一个，私有）**：modules/ + policies.yaml + engine.lock；仅同步与导出
- 本机布局：~/.config/relic（引擎实例/dev）+ ~/.config/relic-sync（身份内容）
- 两速循环：快道=内容 5 分钟 timer；慢道=`npm run upgrade`（tag 受控升级 + engine.lock 更新）

## 关键决策

1. 源码库命名 relic-source（GitHub rename，旧 URL 自动重定向）
2. 每配置身份首次部署自动建库（init-sync；多平台=clone 同一同步库）
3. runtimeRoot = manifest 目录不变量（内容根与引擎 cwd 解耦）
4. 引擎库防混入：CI 断言引擎树永不含 policies.yaml/modules
5. **Windows 原生适配暂时搁置**（后续开发方向：sync-core 跨平台 exec 去 sh -c、schtasks 调度器、路径处理）——用户拍板 2026-09-15

## 新命令

| 命令 | 作用 |
|---|---|
| npm run bootstrap | 一键部署（自检→身份→依赖→sync→调度器→报告）|
| npm run init-sync [-- --import <dir>] | 每身份自动建库（gh 引导登录/种子/导入/engine.lock）|
| npm run sync [-- --content <path>] | 同步原语（内容库发现链：参数>env>relic.config.json>约定路径）|
| npm run upgrade [-- --tag <t>] | 引擎受控升级（慢道）|
| npm run install-schedule | 调度器自动安装（systemd→cron 回退）|

## 后续开发方向

1. **Windows 原生支持**（本次搁置项）：sync-core 跨平台执行、schtasks、路径
2. 内容库轻量 CI（引擎兼容检查 workflow）
3. persona 功能 / Codex-Cursor 适配器
