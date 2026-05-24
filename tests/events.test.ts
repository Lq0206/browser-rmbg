/**
 * browser-rmbg - EventBus Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../src/events';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on and emit', () => {
    it('should call handler when event is emitted', () => {
      const handler = vi.fn();
      eventBus.on('task-start', handler);

      eventBus.emit('task-start', { taskId: 'test-1', fileName: 'test.png' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: 'test-1', fileName: 'test.png' });
    });

    it('should support multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('task-start', handler1);
      eventBus.on('task-start', handler2);

      eventBus.emit('task-start', { taskId: 'test-1', fileName: 'test.png' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('task-start', handler);

      eventBus.emit('task-start', { taskId: 'test-1', fileName: 'test.png' });
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      eventBus.emit('task-start', { taskId: 'test-2', fileName: 'test.png' });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('should remove specific handler', () => {
      const handler = vi.fn();
      eventBus.on('task-start', handler);
      eventBus.off('task-start', handler);

      eventBus.emit('task-start', { taskId: 'test-1', fileName: 'test.png' });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('should call handler only once', () => {
      const handler = vi.fn();
      eventBus.once('task-start', handler);

      eventBus.emit('task-start', { taskId: 'test-1', fileName: 'test.png' });
      eventBus.emit('task-start', { taskId: 'test-2', fileName: 'test.png' });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('waitFor', () => {
    it('should resolve when event is emitted', async () => {
      const promise = eventBus.waitFor('task-start');

      eventBus.emit('task-start', { taskId: 'test-1', fileName: 'test.png' });

      const result = await promise;
      expect(result).toEqual({ taskId: 'test-1', fileName: 'test.png' });
    });

    it('should reject on timeout', async () => {
      await expect(
        eventBus.waitFor('task-start', 10)
      ).rejects.toThrow('Timeout waiting for event');
    });
  });

  describe('listenerCount', () => {
    it('should return correct count', () => {
      expect(eventBus.listenerCount()).toBe(0);

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('task-start', handler1);
      eventBus.on('task-complete', handler2);

      expect(eventBus.listenerCount()).toBe(2);
      expect(eventBus.listenerCount('task-start')).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      const handler = vi.fn();
      eventBus.on('task-start', handler);
      eventBus.clear();

      eventBus.emit('task-start', { taskId: 'test-1', fileName: 'test.png' });
      expect(handler).not.toHaveBeenCalled();
      expect(eventBus.listenerCount()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should not break other handlers when one throws', () => {
      const errorHandler = vi.fn(() => { throw new Error('test error'); });
      const normalHandler = vi.fn();

      eventBus.on('task-start', errorHandler);
      eventBus.on('task-start', normalHandler);

      eventBus.emit('task-start', { taskId: 'test-1', fileName: 'test.png' });

      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
    });
  });
});
