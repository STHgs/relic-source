// =============================================================================
// src/orchestrator/generate.mjs — 流水线控制器
// =============================================================================
// 取代前身的巨型 generate.mjs。职责单一：
//   1. 检测哪些平台适配器在场（detect）
//   2. 跑在场适配器的 generate 产出 FileMap
//   3. install（或 dryRun 仅报告）
//
// 关键设计：
//   - 适配器列表显式注入（不在模块里硬编码 import 全部），便于测试 mock 与将来加 Codex/Cursor
//   - 默认导出跑标准 3 适配器（opencode/omo/claude），用 import() 动态加载
//   - 检测到的适配器才跑 generate；未检测到的进 skipped
//   - dryRun=true：只产 FileMap + 报告，不写盘
// =============================================================================

import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import opencodeAdapter from '../adapters/opencode.mjs';
import omoAdapter from '../adapters/omo.mjs';
import claudeAdapter from '../adapters/claude.mjs';
import { loadPolicies } from '../core/loader.mjs';
import { createValidator } from '../core/validator.mjs';

const DEFAULT_ADAPTERS = [opencodeAdapter, omoAdapter, claudeAdapter];

/**
 * @typedef {Object} GenerateOptions
 * @property {string} [home]             HOME 目录，默认 process.env.HOME
 * @property {boolean} [dryRun]           true=仅报告不写盘
 * @property {object[]} [adapters]       适配器数组，默认 3 个内置适配器
 * @property {(p: string) => boolean} [existsSync]  fs.existsSync 注入（测试 mock）
 */

/**
 * 跑 detect→generate→install 流水线。
 * @param {object} policies  已校验的 policies 对象
 * @param {GenerateOptions} [opts]
 * @returns {Promise<{ok:boolean, fileMaps:object, report:object, dryRun:boolean}>}
 *   fileMaps: { adapterId: FileMap }；report: 各适配器 InstallReport 汇总
 */
export async function generate(policies, opts = {}) {
  const {
    home = process.env.HOME,
    dryRun = false,
    adapters = DEFAULT_ADAPTERS,
    existsSync: exists = existsSync,
  } = opts;

  const env = { home, existsSync: exists };
  const fileMaps = {};
  const reports = {};
  const allWritten = [];
  const allBackups = [];
  const allSkipped = [];
  const allErrors = [];
  let ok = true;

  for (const adapter of adapters) {
    const id = adapter.id;
    const detected = adapter.detect(env);

    if (!detected) {
      allSkipped.push(`${id} (not detected)`);
      reports[id] = { ok: true, written: [], backups: [], skipped: [`${id} (not detected)`], errors: [] };
      continue;
    }

    // generate（纯函数，无 I/O）
    const fm = adapter.generate(policies, env);
    fileMaps[id] = fm;

    if (dryRun) {
      allSkipped.push(`${id} (dryRun)`);
      reports[id] = { ok: true, written: [], backups: [], skipped: [`${id} (dryRun)`], errors: [] };
      continue;
    }

    // install
    const r = adapter.install(fm, { home, dryRun: false });
    reports[id] = r;
    if (r.ok) {
      allWritten.push(...r.written);
      allBackups.push(...r.backups);
    } else {
      ok = false;
      allErrors.push(...r.errors);
    }
    allSkipped.push(...(r.skipped || []));
  }

  return {
    ok,
    fileMaps,
    report: {
      ok,
      written: allWritten,
      backups: allBackups,
      skipped: allSkipped,
      errors: allErrors,
    },
    dryRun,
  };
}

// =============================================================================
// CLI 入口：node src/orchestrator/generate.mjs [--policies <path>] [--dry-run]
// =============================================================================
// 默认行为：读 ./policies.yaml（或 --policies 指定路径）→ 校验 → 检测平台 →
// 真写（不 dryRun，用户跑 generate 就是想生效）。--dry-run 只预览不写盘。
// 输出 JSON 报告到 stdout；错误到 stderr；退出码 0=成功 / 1=参数或校验错。
// =============================================================================

const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (isMain) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const policiesIdx = args.findIndex((a) => a.startsWith('--policies'));
  const policiesPath = policiesIdx >= 0
    ? resolve(args[policiesIdx + 1] || '')
    : resolve(process.cwd(), 'policies.yaml');

  if (!existsSync(policiesPath)) {
    console.error(JSON.stringify({ ok: false, error: `policies.yaml not found: ${policiesPath}` }));
    process.exit(1);
  }

  try {
    const policies = loadPolicies(policiesPath);
    const validate = createValidator();
    const v = validate(policies);
    if (!v.ok) {
      console.error(JSON.stringify({ ok: false, stage: 'validate', errors: v.errors }, null, 2));
      process.exit(1);
    }

    const r = await generate(v.doc, { dryRun });
    console.log(JSON.stringify({
      ok: r.ok,
      dryRun: r.dryRun,
      written: r.report.written,
      backups: r.report.backups,
      skipped: r.report.skipped,
      errors: r.report.errors,
      fileMaps: r.dryRun ? r.fileMaps : undefined,  // dry-run 时输出 fileMap 供预览，真写时省略减体积
    }, null, 2));
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  }
}
