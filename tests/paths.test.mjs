// =============================================================================
// tests/paths.test.mjs — 平台路径变体（Windows 适配 D3）
// =============================================================================
// PA1: POSIX 平台（本机）——XDG 风格单路径
// PA2: win32 模拟——AppData 优先 + .config 兜底双路径
// PA3: firstExisting 探测序
// =============================================================================
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { platformPaths, firstExisting } from '../src/core/paths.mjs';

const realPlatform = process.platform;

describe('PA1: POSIX platform paths', () => {
  it('opencode uses XDG single path', () => {
    const p = platformPaths('/home/u');
    assert.deepEqual(p.opencode, ['/home/u/.config/opencode']);
    assert.equal(p.dsh[0], '/home/u/.dsh');
  });
});

describe('PA2: win32 variant paths', () => {
  beforeEach(() => { Object.defineProperty(process, 'platform', { value: 'win32', configurable: true }); });
  afterEach(() => { Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true }); });
  it('opencode prefers AppData with .config fallback', () => {
    const p = platformPaths('C:\\\\Users\\\\u');
    assert.equal(p.opencode.length, 2);
    assert.ok(p.opencode[0].endsWith(String.raw`\AppData\Roaming\opencode`), 'first: ' + p.opencode[0]);
    assert.ok(p.opencode[1].endsWith(String.raw`\.config\opencode`), 'fallback: ' + p.opencode[1]);
  });
});

describe('PA3: firstExisting probing order', () => {
  it('returns first existing candidate', () => {
    const hit = firstExisting(['/nope1', '/nope2', '/hit'], (p) => p === '/hit');
    assert.equal(hit, '/hit');
  });
  it('returns null when none exist', () => {
    assert.equal(firstExisting(['/a', '/b'], () => false), null);
  });
});
