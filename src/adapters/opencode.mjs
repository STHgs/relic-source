// =============================================================================
// src/adapters/opencode.mjs — OpenCode 原生平台适配器
// =============================================================================
// 从前身 generate.mjs:148-176 端口：buildOpencodeAgent + AGENTS.md。
//
// 角色策略（foundation-plan §2 已记录决策）：**role-flattening**
// 原生 OpenCode 没有 OMO 的 applies_to 角色概念，前身做法是把所有 runtime
// 权限应用到所有 native agent（general/build/explore）。relic 原样保留——
// 过包含是安全的（runtime 仍按 pattern ask/deny）。
//
// FileMap keys (A1): { 'opencode.agent.jsonc', 'AGENTS.md' }
//
// install: 替换 opencode.jsonc 的 agent 字段 + symlink AGENTS.md（具体在 T8 实现）
// =============================================================================

import { existsSync, lstatSync, unlinkSync } from 'fs';
import { join } from 'path';
import { buildPermissionMap } from '../core/permission-map.mjs';
import { renderAgentsMd } from '../render/agents-md.mjs';
import { backup, writeWithHeader, emptyReport, readJsonc } from './base.mjs';

const NATIVE_AGENTS = {
  general: { mode: 'primary' },
  build: { mode: 'subagent' },
  explore: { mode: 'subagent' },
};

/** @type {import('./base.mjs').PlatformAdapter} */
export default {
  id: 'opencode',

  detect(env) {
    return env.existsSync(join(env.home, '.config', 'opencode', 'opencode.jsonc'));
  },

  generate(policies, _env) {
    // opencode.agent.jsonc
    const agentObj = {};
    for (const [name, base] of Object.entries(NATIVE_AGENTS)) {
      agentObj[name] = { ...base, permission: {} };
    }
    // role-flattening: 所有 runtime 权限塞给所有 native agent
    for (const p of policies.permissions || []) {
      if (p.enforcement !== 'runtime') continue;
      const map = buildPermissionMap(p);
      const [tool, val] = Object.entries(map)[0];
      for (const name of Object.keys(agentObj)) {
        const perm = agentObj[name].permission;
        if (typeof val === 'string') {
          perm[tool] = val;
        } else {
          if (!perm[tool] || typeof perm[tool] !== 'object') perm[tool] = {};
          Object.assign(perm[tool], val);
        }
      }
    }

    return {
      'opencode.agent.jsonc': JSON.stringify(agentObj, null, 2) + '\n',
      'AGENTS.md': renderAgentsMd(policies),
    };
  },

  install(fileMap, opts) {
    const report = emptyReport();
    const home = opts.home;
    const configDir = join(home, '.config', 'opencode');
    const configPath = join(configDir, 'opencode.jsonc');
    const agentsMdPath = join(configDir, 'AGENTS.md');

    if (opts.dryRun) {
      report.skipped.push('opencode (dryRun)');
      return report;
    }

    // opencode.agent.jsonc: 备份 + 浅合并 (GAP2 fix)
    // Q6=完全照搬现网：oc.agent = {...(oc.agent||{}), ...genAgent}
    // 整个 agent 键替换（同名 agent 以 gen 为准），其他 agent 保留。
    // 顶层 provider/model/sharing 等完全不动。
    if (fileMap['opencode.agent.jsonc']) {
      try {
        const bak = backup(configPath, opts);
        if (bak) report.backups.push(bak);
        const genAgent = JSON.parse(fileMap['opencode.agent.jsonc']);
        const oc = existsSync(configPath) ? readJsonc(configPath) : {};
        oc.agent = { ...(oc.agent || {}), ...genAgent };
        writeWithHeader(configPath, JSON.stringify(oc, null, 2) + '\n');
        report.written.push(configPath);
      } catch (e) {
        report.ok = false;
        report.errors.push(`opencode.agent.jsonc: ${e.message}`);
      }
    }

    // AGENTS.md: 备份 + 写（不用 symlink，直接写——简单且跨平台稳）
    // 关键：现网 install.sh 把 AGENTS.md 软链到 generated/AGENTS.md。
    // writeFileSync 会跟随 symlink 写到 generated/ 缓存文件，而非替换 symlink。
    // 因此写前先 unlink symlink（若是 symlink），写一个全新普通文件。
    if (fileMap['AGENTS.md']) {
      try {
        const bak = backup(agentsMdPath, opts);
        if (bak) report.backups.push(bak);
        if (existsSync(agentsMdPath) && lstatSync(agentsMdPath).isSymbolicLink()) {
          unlinkSync(agentsMdPath);
        }
        writeWithHeader(agentsMdPath, fileMap['AGENTS.md'], { header: '' });
        report.written.push(agentsMdPath);
      } catch (e) {
        report.ok = false;
        report.errors.push(`AGENTS.md: ${e.message}`);
      }
    }

    return report;
  },
};
