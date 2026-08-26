// =============================================================================
// src/index.mjs — relic 公共 API 门面
// =============================================================================
// 一条龙：load → validate → generate → install
// 这是用户/上层 skill 调用 relic 的唯一入口。
//
// 用法（编程式）:
//   import { pipeline } from './src/index.mjs';
//   const r = await pipeline({ policiesPath: './policies.yaml', dryRun: true });
// =============================================================================

import { loadPolicies } from './core/loader.mjs';
import { createValidator } from './core/validator.mjs';
import { generate } from './orchestrator/generate.mjs';

const validate = createValidator();

/**
 * @typedef {Object} PipelineOptions
 * @property {string} policiesPath      policies.yaml 绝对路径
 * @property {boolean} [dryRun]        true=仅预览不写盘
 * @property {string} [home]          HOME 目录
 */

/**
 * 一条龙跑完 load→validate→generate→install。
 * @param {PipelineOptions} opts
 * @returns {Promise<{ok:boolean, stage:string, errors?:string[], fileMaps?:object, report?:object, policies?:object}>}
 */
export async function pipeline(opts) {
  const { policiesPath, dryRun = false, home = process.env.HOME } = opts;

  // 1. load
  let policies;
  try {
    policies = loadPolicies(policiesPath);
  } catch (e) {
    return { ok: false, stage: 'load', errors: [e.message] };
  }

  // 2. validate
  const v = validate(policies);
  if (!v.ok) {
    return { ok: false, stage: 'validate', errors: v.errors, policies: v.doc };
  }
  policies = v.doc;

  // 3. generate (and install if not dryRun)
  const g = await generate(policies, { home, dryRun });
  return {
    ok: g.ok,
    stage: 'generate',
    fileMaps: g.fileMaps,
    report: g.report,
    policies,
  };
}

// 也导出底层模块，便于高级用法
export { loadPolicies, parsePolicies } from './core/loader.mjs';
export { createValidator } from './core/validator.mjs';
export { generate } from './orchestrator/generate.mjs';
export { injectRule, buildPermissionYaml, buildWorkflowYaml } from './core/inject.mjs';
export { detectPermissionConflict, detectWorkflowConflict } from './core/conflict.mjs';
export { renderAgentsMd } from './render/agents-md.mjs';
