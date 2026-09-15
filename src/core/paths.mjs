// =============================================================================
// src/core/paths.mjs — 平台路径变体（Windows 适配 D3）
// =============================================================================
// 原则：POSIX 路径为历史默认；win32 下各 harness 用其原生惯例位置。
// Windows opencode 指令路径官方未定档 → detect 双路径探测，命中即用（Q3，
// 真机实测后收敛）。
// =============================================================================

/**
 * 各适配器在指定 home 下的候选目录（按优先序；detect 逐个探测）。
 * @param {string} home  归一化用户主目录（exec.userHome()）
 * @returns {{ opencode: string[], claude: string[], dsh: string[], omo: string[] }}
 */
export function platformPaths(home) {
  if (process.platform === 'win32') {
    return {
      opencode: [
        `${home}\\AppData\\Roaming\\opencode`,   // Windows 原生惯例（待实测收敛）
        `${home}\\.config\\opencode`,              // 兜底：官方若走 XDG 风格
      ],
      claude: [`${home}\\.claude`],
      dsh: [`${home}\\.dsh`],
      omo: [`${home}\\.omo`],
    };
  }
  return {
    opencode: [`${home}/.config/opencode`],
    claude: [`${home}/.claude`],
    dsh: [`${home}/.dsh`],
    omo: [`${home}/.omo`],
  };
}

/**
 * 在候选路径中找到第一个存在的目录；全不存在返回 null。
 * @param {string[]} candidates
 * @param {(p:string)=>boolean} exists
 * @returns {string|null}
 */
export function firstExisting(candidates, exists) {
  for (const c of candidates) if (exists(c)) return c;
  return null;
}
