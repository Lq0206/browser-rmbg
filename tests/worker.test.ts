/*
 * @Author: luoqi 575920678@qq.com
 * @Date: 2026-05-23 10:13:31
 * @LastEditors: luoqi 575920678@qq.com
 * @LastEditTime: 2026-05-23 10:22:34
 * @FilePath: /background-remove/tests/worker.test.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * browser-rmbg - Worker Pool Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerPool } from '../src/worker/manager';

describe('WorkerPool', () => {
  let pool: WorkerPool;
  let mockWorkers: Array<{
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    onmessage: ((e: MessageEvent) => void) | null;
  }> = [];

  beforeEach(() => {
    mockWorkers = [];

    // 模拟 Worker 构造函数
    (globalThis as unknown as Record<string, unknown>).Worker = vi.fn(
      (_url: string, _options?: WorkerOptions) => {
        const worker = {
          postMessage: vi.fn(),
          terminate: vi.fn(),
          onmessage: null as ((e: MessageEvent) => void) | null,
        };
        mockWorkers.push(worker);
        return worker;
      }
    );

    pool = new WorkerPool({ maxWorkers: 2 });
  });

  afterEach(() => {
    pool.terminate();
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      const status = pool.getStatus();
      expect(status.totalWorkers).toBe(0);
      expect(status.idleWorkers).toBe(0);
      expect(status.busyWorkers).toBe(0);
      expect(status.queuedTasks).toBe(0);
    });
  });

  describe('terminate', () => {
    it('should terminate all workers', () => {
      pool.terminate();
      expect(pool.getStatus().totalWorkers).toBe(0);
    });
  });
});
