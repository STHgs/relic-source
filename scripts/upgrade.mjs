// =============================================================================
// scripts/upgrade.mjs — relic upgrade（慢道：引擎版本受控升级）
// =============================================================================
// 用法：npm run upgrade [-- --tag <tag>|--latest]
// 流程：引擎脏拒 → fetch --tags → 切目标版本 → npm install → 引擎全量测试 →
//       骨架门禁（新引擎 golden 属合法系统变更，B 断言自动放行并更新账本）→
//       sync 重新部署 → 内容库 engine.lock 更新并推送
// 设计：骨架演进是显式事件；引擎实例永不自动漂移，只经本命令切换。
// =============================================================================
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (file, args, opts = {}) => {
  const r = spawnSync(file, args, { encoding: 'utf8', stdio: opts.inherit ? 'inherit' : 'pipe', env: { ...process.env, GIT_ASKPASS: '', GIT_TERMINAL_PROMPT: '0' }, ...opts });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
};
const die = (m) => { console.error('[upgrade] ' + m); process.exit(1); };

const argv = process.argv.slice(2);
const tagIdx = argv.indexOf('--tag');
const wantTag = tagIdx >= 0 ? argv[tagIdx + 1] : (argv.includes('--latest') ? 'latest' : 'latest');

// 1. 引擎脏拒
const st = run('git', ['status', '--porcelain'], { cwd: REPO });
if (st.ok && st.out.trim() !== '') die('引擎工作树不干净；commit 或 stash 后再升级（引擎实例永不带脏切换）');

// 2. fetch
if (!run('git', ['fetch', 'origin', '--tags'], { cwd: REPO }).ok) die('git fetch 失败');

// 3. 目标解析
let target = wantTag;
if (wantTag === 'latest') {
  const t = run('git', ['tag', '--sort=-creatordate'], { cwd: REPO }).out.trim().split('\n').filter(Boolean);
  target = t.length > 0 ? t[0] : 'origin/main';
  console.log(`[upgrade] 无 --tag，取最新：${target}`);
}
if (!run('git', ['checkout', target], { cwd: REPO, inherit: true }).ok) die(`checkout ${target} 失败`);

// 4. 依赖 + 引擎全量测试
if (!run('npm', ['install'], { cwd: REPO, inherit: true }).ok) die('npm install 失败');
const t = run('npm', ['test'], { cwd: REPO });
const fails = (t.out.match(/^# fail (\d+)/m) || [])[1];
console.log(t.out.split('\n').filter((l) => l.startsWith('# ')).join('\n'));
if (t.ok !== true || (fails !== undefined && fails !== '0')) die('引擎测试未全绿，中止升级（引擎实例保持在原版本）');

// 5. sync（门禁含新 golden 的合法系统变更通道 + 重新部署）
const s = run('npm', ['run', 'sync'], { cwd: REPO, inherit: true });
if (!s.ok) die('sync 失败（骨架门禁或部署异常）');

// 6. engine.lock 更新并推送（在内容库）
const cfgPath = join(REPO, 'relic.config.json');
const contentDir = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')).contentRepo : join(process.env.HOME, '.config', 'relic-sync');
const commit = run('git', ['rev-parse', 'HEAD'], { cwd: REPO }).out.trim();
writeFileSync(join(contentDir, 'engine.lock'), JSON.stringify({
  engine: 'relic-source', tag: target, commit, pinned: new Date().toISOString(),
}, null, 2) + '\n');
const cg = run('git', ['add', 'engine.lock'], { cwd: contentDir });
run('git', ['commit', '-m', `chore: engine upgraded to ${target} (${commit.slice(0, 8)})`], { cwd: contentDir });
run('git', ['push'], { cwd: contentDir });
console.log(`[upgrade] ✅ 引擎已升级至 ${target}，engine.lock 已更新推送`);
