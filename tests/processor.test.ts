/*
 * @Author: luoqi 575920678@qq.com
 * @Date: 2026-05-23 10:13:34
 * @LastEditors: luoqi 575920678@qq.com
 * @LastEditTime: 2026-05-23 10:13:36
 * @FilePath: /background-remove/tests/processor.test.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * browser-rmbg - Processor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Processor } from '../src/processor';
import { EventBus } from '../src/events';
import { WorkerPool } from '../src/worker/manager';
import { MODEL_IDS, MODEL_CONFIGS } from '../src/constants';

describe('Processor', () => {
  let processor: Processor;
  let eventBus: EventBus;
  let workerPool: WorkerPool;

  beforeEach(() => {
    eventBus = new EventBus();
    workerPool = new WorkerPool({ maxWorkers: 1 });

    processor = new Processor({
      eventBus,
      workerPool,
      getCurrentModel: () => MODEL_IDS.RMBG,
      getCurrentDevice: () => 'wasm',
      getCurrentConfig: () => MODEL_CONFIGS[MODEL_IDS.RMBG],
    });
  });

  afterEach(() => {
    processor.destroy();
    workerPool.terminate();
  });

  describe('getTask', () => {
    it('should return undefined for non-existent task', () => {
      expect(processor.getTask('non-existent')).toBeUndefined();
    });
  });

  describe('getAllTasks', () => {
    it('should return empty array initially', () => {
      expect(processor.getAllTasks()).toEqual([]);
    });
  });

  describe('abort', () => {
    it('should return false for non-existent task', () => {
      expect(processor.abort('non-existent')).toBe(false);
    });
  });

  describe('abortAll', () => {
    it('should not throw when no tasks', () => {
      expect(() => processor.abortAll()).not.toThrow();
    });
  });

  describe('event emission', () => {
    it('should emit task-aborted event', () => {
      const handler = vi.fn();
      eventBus.on('task-aborted', handler);

      // 模拟添加一个 abort controller
      const controller = new AbortController();
      // @ts-expect-error accessing private field for testing
      processor.abortControllers.set('test-task', controller);
      // @ts-expect-error accessing private field for testing
      processor.tasks.set('test-task', {
        taskId: 'test-task',
        status: 'running',
        fileName: 'test.png',
        progress: 0,
        stage: 'preparing',
      });

      processor.abort('test-task');

      expect(handler).toHaveBeenCalledWith({ taskId: 'test-task' });
    });
  });
});
