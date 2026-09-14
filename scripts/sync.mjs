// =============================================================================
// scripts/sync.mjs — `npm run sync` 同步原语 CLI（平台无关）
// =============================================================================
// 用法：
//   node scripts/sync.mjs                 拉取 + generate + 哨兵自检 + 写 .last-sync
//   node scripts/sync.mjs --init-deploy   把当前 clone 标记为只读部署位（.relic-deploy
//                                         + pre-commit 护栏，拒绝一切本地提交）
// 宿主调度器接入见 docs/SYNC.md（systemd / cron / Task Scheduler / launchd）。
// 语义保证：工作区脏 / 分叉 / 哨兵缺失 → 退出码 1，绝不静默调和。
// =============================================================================
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runSync, deployGuardHook } from '../src/core/sync-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const exec = (cmd, cwd) => {
  // 无头加固：清掉交互式 askpass（如 VS Code socket），禁止终端挂起等提示——
  // 凭据一律走 credential.helper（gh auth setup-git 配置），失败要快速失败。
  const env = { ...process.env, GIT_ASKPASS: '', SSH_ASKPASS: '', GIT_TERMINAL_PROMPT: '0' };
  const r = spawnSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', env });
  return { ok: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '' };
};

const generateRun = () => new Promise((res) => {
  const r = spawnSync('npm', ['run', 'generate'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    res({ ok: false, written: [], errors: [r.stderr || 'npm run generate failed'] });
    return;
  }
  // CLI 输出 JSON 报告（可能带 npm 前缀行，取最后一个 JSON 对象）
  const out = r.stdout || '';
  const start = out.indexOf('{');
  try {
    const report = JSON.parse(out.slice(start));
    res({ ok: report.ok !== false, written: report.written || [], errors: report.errors || [] });
  } catch {
    res({ ok: true, written: [], errors: [] });
  }
});

const args = process.argv.slice(2);

if (args.includes('--init-deploy')) {
  const marker = resolve(REPO_ROOT, '.relic-deploy');
  writeFileSync(marker, 'deploy-only clone; guard installed\n');
  const hookPath = resolve(REPO_ROOT, '.git/hooks/pre-commit');
  writeFileSync(hookPath, deployGuardHook(), { mode: 0o755 });
  console.log('[relic] deploy marker written + pre-commit guard installed:');
  console.log('  ' + marker);
  console.log('  ' + hookPath);
  process.exit(0);
}

const result = await runSync({
  exec,
  cwd: REPO_ROOT,
  generateRun,
  read: (p) => readFileSync(p, 'utf8'),
  writeState: (p, s) => writeFileSync(resolve(REPO_ROOT, p), s),
});

if (result.ok) {
  console.log(`[relic] sync OK — commit ${String(result.commit).slice(0, 8)}${result.pulled ? ' (pulled)' : ' (already current)'}; generated ${result.generated.length} file(s)`);
  process.exit(0);
}
console.error(`[relic] sync FAILED at stage "${result.stage}": ${result.reason}`);
process.exit(1);
