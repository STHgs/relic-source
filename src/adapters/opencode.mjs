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
import { platformPaths, firstExisting } from '../core/paths.mjs';

/** @type {import('./base.mjs').PlatformAdapter} */
export default {
  id: 'opencode',

  detect(env) {
    // 双路径探测（D3）：win32 AppData 惯例 + POSIX XDG，命中任一即可
    const dirs = platformPaths(env.home).opencode;
    return firstExisting(dirs, (d) => env.existsSync(join(d, 'opencode.jsonc'))) !== null;
  },

  generate(policies, _env) {
    return { 'AGENTS.md': renderAgentsMd(policies) };
  },

  install(fileMap, opts) {
    const report = emptyReport();
    const home = opts.home;
    // install 同样双路径：优先已存在目录；全新安装写第一个候选
    const dirs = platformPaths(home).opencode;
    const target = firstExisting(dirs, (d) => existsSync(join(d, 'opencode.jsonc')))
      ?? firstExisting(dirs, existsSync)
      ?? dirs[0];
    const agentsMdPath = join(target, 'AGENTS.md');

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
