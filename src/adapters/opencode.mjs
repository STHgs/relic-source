// =============================================================================
// src/adapters/opencode.mjs — OpenCode 原生平台适配器
// =============================================================================
// 架构修订（v4.1 findings-staging D 节）：**只治主 agent**
// 执行层 runtime permission 只注入 PRIMARY_AGENT（general）。
// 原生 build/explore 的 permission 由 OpenCode 内置默认管，relic 不注入。
// 与 omo 适配器保持一致：平台代码管 subagent，relic 管主 agent + AGENTS.md。
//
// 旧版 role-flattening（把 runtime 权限塞给 general/build/explore 三 agent）
// 已废弃——那是过包含，且与"只治主 agent"架构不一致。
//
// FileMap keys: { 'opencode.agent.jsonc', 'AGENTS.md' }
// install: 浅合并 opencode.jsonc 的 agent 字段 + 写 AGENTS.md
// =============================================================================

import { existsSync, lstatSync, unlinkSync } from 'fs';
import { join } from 'path';
import { buildPermissionMap } from '../core/permission-map.mjs';
import { renderAgentsMd } from '../render/agents-md.mjs';
import { backup, writeWithHeader, emptyReport, readJsonc } from './base.mjs';

/**
* 该平台的主 agent 名——执行层 runtime permission 只注入到此 agent。
* 新 harness 接入时改这一个常量即可。
*/
const PRIMARY_AGENT = 'general';

/** @type {import('./base.mjs').PlatformAdapter} */
export default {
  id: 'opencode',

  detect(env) {
    return env.existsSync(join(env.home, '.config', 'opencode', 'opencode.jsonc'));
  },

  generate(policies, _env) {
    // opencode.agent.jsonc: 只注入 PRIMARY_AGENT 的 permission（含 mode 保留主 agent 标识）
    const agentObj = {};
    agentObj[PRIMARY_AGENT] = { mode: 'primary', permission: {} };
    const perm = agentObj[PRIMARY_AGENT].permission;
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
