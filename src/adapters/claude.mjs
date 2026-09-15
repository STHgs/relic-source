// =============================================================================
// src/adapters/claude.mjs — Claude Code 平台适配器
// =============================================================================
// F1 决策落地：claude.hooks.json 已删（前身死代码，F1=DROP）。
// Claude 适配器只产 AGENTS.md（A4 验证：FileMap 只有 'AGENTS.md' 一个 key）。
//
// FileMap keys (A4): { 'AGENTS.md' } only — no claude.hooks.json
// install: 写到 ~/.claude/AGENTS.md（F3 默认路径）
// =============================================================================

import { existsSync } from 'fs';
import { join } from 'path';
import { renderAgentsMd } from '../render/agents-md.mjs';
import { backup, writeWithHeader, emptyReport } from './base.mjs';
import { platformPaths } from '../core/paths.mjs';

/** @type {import('./base.mjs').PlatformAdapter} */
export default {
  id: 'claude',

  detect(env) {
    return env.existsSync(platformPaths(env.home).claude[0]);
  },

  generate(policies, _env) {
    return { 'AGENTS.md': renderAgentsMd(policies) };
  },

  install(fileMap, opts) {
    const report = emptyReport();
    const home = opts.home;
    const claudeDir = platformPaths(home).claude[0];
    const agentsMdPath = join(claudeDir, 'AGENTS.md');

    if (opts.dryRun) {
      report.skipped.push('claude (dryRun)');
      return report;
    }
    if (!fileMap['AGENTS.md']) {
      report.skipped.push('claude (no AGENTS.md in map)');
      return report;
    }
    try {
      const bak = backup(agentsMdPath, opts);
      if (bak) report.backups.push(bak);
      writeWithHeader(agentsMdPath, fileMap['AGENTS.md'], { header: '' });
      report.written.push(agentsMdPath);
    } catch (e) {
      report.ok = false;
      report.errors.push(`AGENTS.md: ${e.message}`);
    }
    return report;
  },
};
