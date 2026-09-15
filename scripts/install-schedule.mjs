// =============================================================================
// scripts/install-schedule.mjs — 宿主调度器自动安装（bootstrap 第 6 步调用）
// =============================================================================
// 探测顺序：systemd user bus → crontab → 报错（Windows 原生支持为后续开发方向，
// 见 docs/SYNC.md「后续方向」）。
// =============================================================================
import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (file, args, opts = {}) => {
  const r = spawnSync(file, args, { encoding: 'utf8', ...opts });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
};

// systemd？
const sysd = run('systemctl', ['--user', 'is-system-running']);
if (sysd.ok || !sysd.out.includes('Failed to connect')) {
  const dir = join(process.env.HOME, '.config', 'systemd', 'user');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'relic-sync.service'), `[Unit]
Description=relic sync (pull --ff-only + generate + skeleton gate)

[Service]
Type=oneshot
WorkingDirectory=${REPO}
ExecStart=/usr/bin/env npm run sync
`);
  writeFileSync(join(dir, 'relic-sync.timer'), `[Unit]
Description=relic sync every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
`);
  run('systemctl', ['--user', 'daemon-reload']);
  const en = run('systemctl', ['--user', 'enable', '--now', 'relic-sync.timer']);
  console.log(en.ok ? '[schedule] ✅ systemd user timer 已启用（每 5 分钟）' : '[schedule] systemd enable 失败：' + en.out);
  console.log('[schedule] 建议执行：sudo loginctl enable-linger $USER  （关终端后 timer 存活）');
  process.exit(en.ok ? 0 : 1);
}

// cron 回退
const line = `*/5 * * * * cd ${REPO} && npm run sync >> ~/.relic-sync.log 2>&1`;
const cur = run('crontab', ['-l']).out;
if (cur.includes('relic sync') || cur.includes('npm run sync')) {
  console.log('[schedule] ✅ crontab 已有 relic sync 条目'); process.exit(0);
}
const next = (cur.trim() + '\n' + line + '\n').replace(/^\n/, '');
const ins = run('sh', ['-c', `printf '%s' "${next.replace(/"/g, '\"')}" | crontab -`]);
console.log(ins.ok ? '[schedule] ✅ cron 已安装（每 5 分钟）' : '[schedule] crontab 写入失败（权限？）——请手动加：\n  ' + line);
process.exit(ins.ok ? 0 : 1);
