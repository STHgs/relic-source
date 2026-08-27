// =============================================================================
// src/adapters/omo.mjs — OMO (Oh-My-OpenCode) 平台适配器
// =============================================================================
// 从前身 generate.mjs:109-131 端口：buildOmoPermission。
//
// 角色策略（foundation-plan §2）：**role-preserving**
// applies_to 角色映射到具体 agent 名：
//   primary  → sisyphus
//   deep     → hephaestus
//   subagent → sisyphus-junior, atlas
//   all      → 全部 4 个
// 前身 generate.mjs:38-53 的 resolveAgents 逻辑。
//
// FileMap keys (A2): { 'omo.permission.jsonc' }
// install: deep-merge 进 ~/.omo/omo.jsonc 各 agent 的 permission 字段
// =============================================================================

import { existsSync } from 'fs';
import { join } from 'path';
import { buildPermissionMap } from '../core/permission-map.mjs';
import { backup, writeWithHeader, emptyReport, parseJsonc, readJsonc } from './base.mjs';

const ROLE_TO_AGENTS = {
  primary: ['sisyphus'],
  deep: ['hephaestus'],
  subagent: ['sisyphus-junior', 'atlas'],
};
const ALL_AGENTS = ['sisyphus', 'hephaestus', 'sisyphus-junior', 'atlas'];

/**
 * applies_to 角色数组 → 具体 agent 名数组。
 * @param {string[]} appliesTo
 * @returns {string[]}
 */
export function resolveAgents(appliesTo) {
  if (appliesTo.includes('all')) return [...ALL_AGENTS];
  const set = new Set();
  for (const role of appliesTo) {
    for (const a of ROLE_TO_AGENTS[role] || []) set.add(a);
  }
  return [...set];
}

/** @type {import('./base.mjs').PlatformAdapter} */
export default {
  id: 'omo',

  detect(env) {
    return env.existsSync(join(env.home, '.omo', 'omo.jsonc'));
  },

  generate(policies, _env) {
    const result = {};
    for (const p of policies.permissions || []) {
      if (p.enforcement !== 'runtime') continue;
      const agents = resolveAgents(p.applies_to);
      const map = buildPermissionMap(p);
      const [tool, val] = Object.entries(map)[0];
      for (const agent of agents) {
        if (!result[agent]) result[agent] = { permission: {} };
        const perm = result[agent].permission;
        if (typeof val === 'string') {
          perm[tool] = val;
        } else {
          if (!perm[tool] || typeof perm[tool] !== 'object') perm[tool] = {};
          Object.assign(perm[tool], val);
        }
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
