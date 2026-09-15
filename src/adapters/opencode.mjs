// =============================================================================
// src/adapters/opencode.mjs — OpenCode 原生平台适配器
// =============================================================================
// 治理哲学转变（用户拍板 2026-09-15）：完全去除运行时 permission 硬约束，
// 全平台统一 route A——只产 AGENTS.md，约束全量渲染、agent 自律执行。
// （历史：v4.1 曾只注入 PRIMARY_AGENT=general 的 runtime permission；
//   更早的 role-flattening 多 agent 注入已于 2026-09-15 清理退役。）
//
// FileMap keys: { 'AGENTS.md' }
// install: 写 ~/.config/opencode/AGENTS.md（写前处理 symlink）
// =============================================================================

import { existsSync, lstatSync, unlinkSync } from 'fs';
import { join } from 'path';
import { renderAgentsMd } from '../render/agents-md.mjs';
import { backup, writeWithHeader, emptyReport } from './base.mjs';

/** @type {import('./base.mjs').PlatformAdapter} */
export default {
  id: 'opencode',

  detect(env) {
    return env.existsSync(join(env.home, '.config', 'opencode', 'opencode.jsonc'));
  },

  generate(policies, _env) {
    return { 'AGENTS.md': renderAgentsMd(policies) };
  },

  install(fileMap, opts) {
    const report = emptyReport();
    const home = opts.home;
    const agentsMdPath = join(home, '.config', 'opencode', 'AGENTS.md');

    if (opts.dryRun) {
      report.skipped.push('opencode (dryRun)');
      return report;
    }
    if (!fileMap['AGENTS.md']) {
      report.skipped.push('opencode (no AGENTS.md in map)');
      return report;
    }
    try {
      const bak = backup(agentsMdPath, opts);
      if (bak) report.backups.push(bak);
      // 历史现场曾把 AGENTS.md 软链到 generated/ 缓存——写前先摘除 symlink
      if (existsSync(agentsMdPath) && lstatSync(agentsMdPath).isSymbolicLink()) {
        unlinkSync(agentsMdPath);
      }
      writeWithHeader(agentsMdPath, fileMap['AGENTS.md'], { header: '' });
      report.written.push(agentsMdPath);
    } catch (e) {
      report.ok = false;
      report.errors.push(`AGENTS.md: ${e.message}`);
    }
    return report;
  },
};
