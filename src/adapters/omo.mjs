// =============================================================================
// src/adapters/omo.mjs — OMO (Oh-My-OpenCode) 平台适配器
// =============================================================================
// 架构修订（v4.1 findings-staging D 节）：**只治主 agent**
// 执行层 runtime permission 只注入 PRIMARY_AGENT（sisyphus）。
// subagent 的 permission 由 OMO 插件 TS 工厂硬编码（oracle/explore/librarian
// 等 deny write/edit/task），relic 不注入——经三轮 librarian 查证：
//   1. omo.jsonc 的 agentOverrides 路径对 sisyphus LIVE（经 deepMerge 生效）
//   2. subagent permission 不读 omo.jsonc，来自 TS 工厂代码
//   3. AGENTS.md 被 OpenCode V2 注入所有 agent，subagent 直接读到
// 劝导层 AGENTS.md 负责对 subagent 说话（subagent 直接读，不需主 agent 转达）。
//
// 新 harness 接入只需声明 PRIMARY_AGENT 常量，不再画 ROLE_TO_AGENTS 全映射表。
//
// FileMap keys: { 'omo.permission.jsonc' }
// install: deep-merge 进 ~/.omo/omo.jsonc [opencode].agents.sisyphus.permission
// =============================================================================

import { existsSync } from 'fs';
import { join } from 'path';
import { buildPermissionMap } from '../core/permission-map.mjs';
import { backup, writeWithHeader, emptyReport, readJsonc } from './base.mjs';

/**
* 该平台的主 agent 名——执行层 runtime permission 只注入到此 agent。
* 新 harness 接入时改这一个常量即可。
*/
const PRIMARY_AGENT = 'sisyphus';

/** @type {import('./base.mjs').PlatformAdapter} */
export default {
  id: 'omo',

  detect(env) {
    return env.existsSync(join(env.home, '.omo', 'omo.jsonc'));
  },

  generate(policies, _env) {
    const result = {};
    result[PRIMARY_AGENT] = { permission: {} };
    const perm = result[PRIMARY_AGENT].permission;
    for (const p of policies.permissions || []) {
      if (p.enforcement !== 'runtime') continue;
      // 只处理 applies_to 含 primary 或 all 的规则——只治主 agent
      if (!p.applies_to.includes('primary') && !p.applies_to.includes('all')) continue;
      const map = buildPermissionMap(p);
      const [tool, val] = Object.entries(map)[0];
      if (typeof val === 'string') {
        perm[tool] = val;
      } else {
        if (!perm[tool] || typeof perm[tool] !== 'object') perm[tool] = {};
        Object.assign(perm[tool], val);
      }
    }
    return { 'omo.permission.jsonc': JSON.stringify(result, null, 2) + '\n' };
  },

  install(fileMap, opts) {
    const report = emptyReport();
    const home = opts.home;
    const configPath = join(home, '.omo', 'omo.jsonc');

    if (opts.dryRun) {
      report.skipped.push('omo (dryRun)');
      return report;
    }
    if (!fileMap['omo.permission.jsonc']) {
      report.skipped.push('omo (no permission file in map)');
      return report;
    }
    try {
      const bak = backup(configPath, opts);
      if (bak) report.backups.push(bak);
      // GAP1 fix: deep-merge permission into existing omo.jsonc
      // (faithful port of live install.sh:87-94). Preserves
      // model/fallback_models and other top-level + per-agent fields.
      const genPerm = JSON.parse(fileMap['omo.permission.jsonc']);
      const omo = existsSync(configPath) ? readJsonc(configPath) : {};
      if (!omo['[opencode]']) omo['[opencode]'] = {};
      if (!omo['[opencode]'].agents) omo['[opencode]'].agents = {};
      for (const [agentName, agentOverride] of Object.entries(genPerm)) {
        if (!omo['[opencode]'].agents[agentName]) omo['[opencode]'].agents[agentName] = {};
        const existing = omo['[opencode]'].agents[agentName];
        const newPerm = agentOverride.permission || {};
        existing.permission = { ...(existing.permission || {}), ...newPerm };
      }
      writeWithHeader(configPath, JSON.stringify(omo, null, 2) + '\n');
      report.written.push(configPath);
    } catch (e) {
      report.ok = false;
      report.errors.push(`omo.permission.jsonc: ${e.message}`);
    }
    return report;
  },
};
