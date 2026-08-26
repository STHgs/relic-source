// =============================================================================
// src/core/inject.mjs — 安全注入新规则到 policies.yaml（从前身 inject-rule.mjs 端口 + bug#1 修复）
// =============================================================================
// 流程（与前身语义一致）：
//   1. 读 policies.yaml
//   2. 调 conflict.mjs 做重复/冲突检测
//   3. id 冲突 → 返回 { ok:false, blocked:'id_conflict' }（exit 2 语义）
//   4. dry-run：返回预览（含 yamlSnippet），不落盘
//   5. apply：备份 → 写入 → 校验（ajv）→ 失败回滚 → 调 onInstall（由 T10 orchestrator 注入）
//
// ── bug#1 修复（核心）──────────────────────────────────────────────
// 前身 lib/inject-rule.mjs:99-101 把 patterns 写成裸字符串：
//     `for (const p of rule.patterns) lines.push('      - "' + p + '"')`
// 但 schema 要求 [{pattern, action?}] 对象 → generate.mjs:78 读 item.pattern → undefined → 校验失败 → apply 回滚。
// relic 修复：
//   - patterns 全链路用对象：emit `  - pattern: "..."`（带可选 action）
//   - 不再 gate on tool==='bash'（前身第 99 行只在 bash 时输出 patterns，非 bash 的 patterned 规则丢 patterns）
// =============================================================================

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { parse, stringify } from 'yaml';
import { detectPermissionConflict, detectWorkflowConflict } from './conflict.mjs';
import { createValidator } from './validator.mjs';

const validate = createValidator();

/**
 * 构造要追加到 permissions 段的 YAML 片段。
 * bug#1 修复：patterns 一律输出为对象形式，所有工具都输出（不 gate on bash）。
 * @param {object} rule
 * @returns {string}
 */
export function buildPermissionYaml(rule) {
  const lines = [`  - id: ${rule.id}`];
  lines.push(`    intent: "${rule.intent}"`);
  lines.push(`    applies_to: [${rule.applies_to.join(', ')}]`);
  lines.push(`    enforcement: ${rule.enforcement}`);
  lines.push(`    tool: ${rule.tool}`);
  if (rule.patterns && rule.patterns.length > 0) {
    lines.push(`    patterns:`);
    for (const p of rule.patterns) {
      if (p.action) {
        lines.push(`      - pattern: "${p.pattern}"`);
        lines.push(`        action: ${p.action}`);
      } else {
        lines.push(`      - pattern: "${p.pattern}"`);
      }
    }
  }
  lines.push(`    action: ${rule.action}`);
  if (rule.alternatives && rule.alternatives.length > 0) {
    lines.push(`    alternatives:`);
    for (const a of rule.alternatives) lines.push(`      - "${a}"`);
  }
  return lines.join('\n');
}

/**
 * 构造要追加到 workflows 段的 YAML 片段。
 * @param {object} wf
 * @returns {string}
 */
export function buildWorkflowYaml(wf) {
  const lines = [`  - id: ${wf.id}`];
  lines.push(`    intent: "${wf.intent}"`);
  if (wf.applies_when) lines.push(`    applies_when: "${wf.applies_when}"`);
  lines.push(`    steps:`);
  for (const s of wf.steps) lines.push(`      - "${s}"`);
  return lines.join('\n');
}

/**
 * @typedef {Object} InjectOptions
 * @property {string} policiesPath        policies.yaml 绝对路径
 * @property {'permission'|'workflow'} type
 * @property {object} rule                要注入的新规则
 * @property {boolean} dryRun            true=只预览，false=apply
 * @property {(policies: object) => Promise<{ok:boolean, errors?:string[]}>} [onValidate]
 *     可选：自定义校验回调；默认用本模块的 ajv validator。
 *     apply 模式下若 onValidate 返回 ok:false → 回滚 + 报告 rolledBack:true。
 * @property {(policies: object) => Promise<{ok:boolean, errors?:string[]}>} [onInstall]
 *     可选：apply 写入后调用的 install 回调（由 T10 orchestrator 注入，跑 generate+install）。
 *     返回 ok:false → 回滚 policies.yaml + 报告 rolledBack:true（exit 4 语义）。
 * @property {() => Date} [now]           时间戳注入（测试用）
 */

/**
 * @typedef {Object} InjectResult
 * @property {boolean} ok
 * @property {string} [blocked]           'id_conflict' | 'validation_failed' | 'install_failed'
 * @property {object} [conflict]          idConflict 详情
 * @property {string} [yamlSnippet]      dry-run 预览的 YAML 片段
 * @property {string} [targetSection]     'permissions' | 'workflows'
 * @property {number} [previousCount]
 * @property {number} [newCount]
 * @property {object} [conflictCheck]     duplicates/conflicts/warnings
 * @property {boolean} [rolledBack]       apply 模式校验或 install 失败时回滚
 * @property {string} [backupPath]
 * @property {string[]} [errors]
 * @property {string} [message]
 */

/**
 * 注入新规则到 policies.yaml。
 * @param {InjectOptions} opts
 * @returns {Promise<InjectResult>}
 */
export async function injectRule(opts) {
  const { policiesPath, type, rule, dryRun, onValidate, onInstall, now = () => new Date() } = opts;

  // 1. 读现有 policies
  const raw = readFileSync(policiesPath, 'utf-8');
  const policies = parse(raw);
  const existing = type === 'permission' ? (policies.permissions || []) : (policies.workflows || []);

  // 2. 冲突检测
  const conflict = type === 'permission'
    ? detectPermissionConflict(rule, existing)
    : detectWorkflowConflict(rule, existing);

  // 3. id 冲突 → 硬拒
  if (conflict.idConflict) {
    return {
      ok: false,
      blocked: 'id_conflict',
      conflict: conflict.idConflict,
      message: conflict.idConflict.suggestion,
    };
  }

  // 4. 构造 YAML 片段（bug#1 修复在 buildPermissionYaml/buildWorkflowYaml 内）
  const yamlSnippet = type === 'permission'
    ? buildPermissionYaml(rule)
    : buildWorkflowYaml(rule);
  const targetSection = type === 'permission' ? 'permissions' : 'workflows';
  const previousCount = existing.length;
  const newCount = previousCount + 1;

  // 5. dry-run：返回预览
  if (dryRun) {
    return {
      ok: true,
      mode: 'dry-run',
      type,
      newRule: rule,
      yamlSnippet,
      targetSection,
      conflictCheck: {
        duplicates: conflict.duplicates,
        conflicts: conflict.conflicts,
        warnings: conflict.warnings,
      },
      preview: {
        willAppendTo: `${policiesPath} (${targetSection} 段末尾)`,
        currentCount: previousCount,
        newCount,
      },
    };
  }

  // 6. apply：备份 → 写入 → 校验 → install → 失败回滚
  const ts = now().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupPath = `${policiesPath}.bak.${ts}`;
  copyFileSync(policiesPath, backupPath);

  // 6a. 注入到 policies 对象
  if (type === 'permission') {
    policies.permissions = [...existing, rule];
  } else {
    policies.workflows = [...existing, rule];
  }

  // 6b. 写回 policies.yaml
  writeFileSync(policiesPath, stringify(policies));

  // 6c. 校验（默认用 ajv，可注入 onValidate 覆盖）
  const validateFn = onValidate || ((p) => {
    const r = validate(p);
    return r.ok ? { ok: true } : { ok: false, errors: r.errors };
  });
  const vRes = await validateFn(policies);
  if (!vRes.ok) {
    copyFileSync(backupPath, policiesPath);  // 回滚
    return {
      ok: false,
      blocked: 'validation_failed',
      errors: vRes.errors || [],
      rolledBack: true,
      backupPath,
    };
  }

  // 6d. install（由 T10 orchestrator 注入 onInstall；未注入则跳过，视为成功）
  if (onInstall) {
    const iRes = await onInstall(policies);
    if (!iRes.ok) {
      copyFileSync(backupPath, policiesPath);  // 回滚 policies
      return {
        ok: false,
        blocked: 'install_failed',
        errors: iRes.errors || [],
        rolledBack: true,
        backupPath,
      };
    }
  }

  // 6e. 成功
  return {
    ok: true,
    mode: 'apply',
    type,
    ruleId: rule.id,
    backupPath,
    previousCount,
    newCount,
    message: `新规则 "${rule.id}" 已生效。${targetSection} 总数: ${newCount}。`,
  };
}
