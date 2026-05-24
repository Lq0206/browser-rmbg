/**
 * browser-rmbg - Test Setup
 */

import { vi } from 'vitest';

// 使用 fake-indexeddb 提供真实的 IndexedDB 模拟
import 'fake-indexeddb/auto';

// 模拟全局对象
Object.defineProperty(globalThis, 'navigator', {
  value: {
    hardwareConcurrency: 4,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    platform: 'MacIntel',
    gpu: undefined,
    maxTouchPoints: 0,
  },
  writable: true,
  configurable: true,
});

// 模拟 WebAssembly
Object.defineProperty(globalThis, 'WebAssembly', {
  value: {
    validate: vi.fn(() => true),
  },
  writable: true,
  configurable: true,
});

// 模拟 Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;

  postMessage = vi.fn();
  terminate = vi.fn();

  constructor(public url: string, public options?: WorkerOptions) {}
}

Object.defineProperty(globalThis, 'Worker', {
  value: MockWorker,
  writable: true,
  configurable: true,
});

// 模拟 URL.createObjectURL
globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
globalThis.URL.revokeObjectURL = vi.fn();

// 模拟 performance.now
if (!globalThis.performance) {
  Object.defineProperty(globalThis, 'performance', {
    value: { now: vi.fn(() => Date.now()) },
  });
}
