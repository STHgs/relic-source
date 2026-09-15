// =============================================================================
// scripts/init-sync.mjs — 配置身份同步库初始化（每身份首次部署自动建库）
// =============================================================================
// 用法：
//   npm run init-sync [-- --name <repo>] [--path <本地路径>] [--import <源目录>]
//   --name   同步库名，默认 relic-sync（在 gh 认证账号下创建私有库）
//   --path   本地工作副本路径，默认 ~/.config/relic-sync
//   --import 从既有目录导入 policies.yaml + modules/（迁移身份用）；
//            缺省则从引擎 template/ 种子（新身份）
// 流程：gh 认证检查（未登录接管终端交互登录）→ 建私有库 → 种子/导入 →
//       首 commit + push → engine.lock → 身份登记（relic.config.json）→ 指引输出
// 幂等：已存在同名远端库 → 报错并给出 clone 接入提示后退出。
// =============================================================================
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'fs';
import { resolve, dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (file, args, opts = {}) => {
  const r = spawnSync(file, args, { encoding: 'utf8', env: { ...process.env, GIT_ASKPASS: '', GIT_TERMINAL_PROMPT: '0' }, ...opts });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
};
const gitAt = (args, cwd) => run('git', args, { cwd });
const gh = (args, opts = {}) => run('gh', args, opts);

const argv = process.argv.slice(2);
const argOf = (flag, dflt) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : dflt;
};
const NAME = argOf('--name', 'relic-sync');
const PATH_ = resolve(argOf('--path', join(process.env.HOME, '.config', 'relic-sync')));
const IMPORT = argOf('--import', null);

const die = (msg) => { console.error('[init-sync] ' + msg); process.exit(1); };

// ---- 1. 环境与认证 ----
if (!run('git', ['--version']).ok) die('git 不可用，请先安装');
if (!gh(['--version']).ok) die('gh CLI 不可用，请先安装 (https://cli.github.com)');
let authOk = false;
try {
  const st = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  authOk = st.status === 0;
} catch { authOk = false; }
if (!authOk) {
  console.log('[init-sync] 未登录 GitHub，接管终端进行一次性授权（浏览器设备码）…');
  const r = spawnSync('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], { stdio: 'inherit' });
  if (r.status !== 0) die('gh auth login 失败');
}

// ---- 2. 同名远端库冲突检查 ----
if (gh(['repo', 'view', NAME]).ok) {
  die(`远端已存在 ${NAME}。多平台接入请改用：git clone https://github.com/<you>/${NAME}.git ${PATH_} && npm --prefix ${REPO} run sync`);
}

// ---- 3. 本地工作副本 ----
if (existsSync(PATH_) && readdirSync(PATH_).length > 0) die(`本地路径已非空：${PATH_}`);
mkdirSync(PATH_, { recursive: true });

// ---- 4. 种子/导入 ----
const seedDir = IMPORT ? resolve(IMPORT) : join(REPO, 'template');
const seedPolicies = join(seedDir, 'policies.yaml');
const seedModules = join(seedDir, 'modules');
if (!existsSync(seedPolicies) || !existsSync(seedModules)) die(`种子源不完整：${seedDir}`);
writeFileSync(join(PATH_, 'policies.yaml'), readFileSync(seedPolicies, 'utf8'));
mkdirSync(join(PATH_, 'modules'), { recursive: true });
for (const ent of readdirSync(seedModules, { withFileTypes: true })) {
  if (!ent.isDirectory()) continue;
  mkdirSync(join(PATH_, 'modules', ent.name), { recursive: true });
  copyFileSync(join(seedModules, ent.name, 'module.yaml'), join(PATH_, 'modules', ent.name, 'module.yaml'));
}
writeFileSync(join(PATH_, '.gitignore'), '.last-sync\n.relic-deploy\n');

// ---- 5. engine.lock（锁引擎版本）----
const engineCommit = gitAt(['rev-parse', 'HEAD'], REPO).out.trim();
const engineTag = gitAt(['describe', '--tags', '--exact-match'], REPO).ok
  ? gitAt(['describe', '--tags', '--exact-match'], REPO).out.trim() : 'dev';
writeFileSync(join(PATH_, 'engine.lock'), JSON.stringify({
  engine: 'relic-source',
  tag: engineTag,
  commit: engineCommit,
  pinned: new Date().toISOString(),
}, null, 2) + '\n');

// ---- 6. 首 commit + 建库 + push ----
if (!gitAt(['init', '-b', 'main'], PATH_).ok) die('git init 失败');
gitAt(['config', 'user.email'], PATH_); // 继承全局
if (!gitAt(['add', '-A'], PATH_).ok) die('git add 失败');
if (!gitAt(['commit', '-m', `init: identity content (${IMPORT ? 'imported from ' + basename(IMPORT) : 'seeded from template'}) + engine.lock`], PATH_).ok) die('首 commit 失败');
const create = gh(['repo', 'create', NAME, '--private', '--source', PATH_, '--push']);
if (!create.ok) die('gh repo create 失败：' + create.out.trim());

// ---- 7. 身份登记（引擎侧 relic.config.json，gitignored）----
const cfgPath = join(REPO, 'relic.config.json');
let cfg = {};
if (existsSync(cfgPath)) { try { cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch { cfg = {}; } }
cfg.contentRepo = PATH_;
cfg.syncRemote = `https://github.com/${gh(['api', 'user', '-q', '.login']).out.trim()}/${NAME}.git`;
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

// gitignore 登记（幂等）
const engineGi = join(REPO, '.gitignore');
const giText = existsSync(engineGi) ? readFileSync(engineGi, 'utf8') : '';
if (!giText.includes('relic.config.json')) {
  writeFileSync(engineGi, giText + '\n# Per-machine identity registration (engine side)\nrelic.config.json\n');
}

console.log(`[init-sync] ✅ 同步库已创建并推送：${cfg.syncRemote}`);
console.log(`[init-sync] 本地工作副本：${PATH_}`);
console.log(`[init-sync] 引擎版本锁定：${engineTag} @ ${engineCommit.slice(0, 8)}`);
console.log('[init-sync] 下一步：');
console.log(`  1) 首次部署：cd ${REPO} && npm run sync`);
console.log(`  2) 修改规则：编辑 ${PATH_}/modules/<id>/module.yaml 后 commit+push`);
console.log(`  3) 新平台接入：git clone ${cfg.syncRemote} ~/.config/relic-sync 后同 1`);
