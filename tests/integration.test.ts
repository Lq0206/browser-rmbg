/**
 * browser-rmbg - Integration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BGRemove } from '../src/index';

describe('BGRemove Integration', () => {
  let bgRemove: BGRemove;

  beforeEach(() => {
    bgRemove = new BGRemove({
      enableCache: false,
      maxWorkers: 1,
    });
  });

  afterEach(() => {
    bgRemove.destroy();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const instance = new BGRemove();
      expect(instance).toBeInstanceOf(BGRemove);
      instance.destroy();
    });

    it('should create instance with custom options', () => {
      const instance = new BGRemove({
        maxWorkers: 2,
        processTimeout: 30000,
        enableCache: false,
      });
      expect(instance).toBeInstanceOf(BGRemove);
      instance.destroy();
    });
  });

  describe('static detectDevices', () => {
    it('should detect device capabilities', async () => {
      const caps = await BGRemove.detectDevices();
      expect(caps).toHaveProperty('webgpu');
      expect(caps).toHaveProperty('webgl');
      expect(caps).toHaveProperty('wasm');
      expect(caps).toHaveProperty('recommended');
      expect(caps).toHaveProperty('isIOS');
      expect(caps).toHaveProperty('isMobile');
      expect(caps).toHaveProperty('hardwareConcurrency');
    });
  });

  describe('event system', () => {
    it('should support event listeners', () => {
      const handler = vi.fn();
      const unsubscribe = bgRemove.on('device-detected', handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should support once listeners', () => {
      const handler = vi.fn();
      const unsubscribe = bgRemove.once('task-start', handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      const status = bgRemove.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.model).toBeNull();
      expect(status.device).toBeNull();
      expect(status.workers).toHaveProperty('totalWorkers');
      expect(status.tasks).toEqual([]);
    });
  });

  describe('getCapabilities', () => {
    it('should return device capabilities', async () => {
      const caps = await bgRemove.getCapabilities();
      expect(caps.wasm.supported).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      bgRemove.destroy();
      expect(() => bgRemove.getStatus()).not.toThrow();
    });

    it('should throw when calling methods after destroy', () => {
      bgRemove.destroy();
      expect(() => bgRemove.getStatus()).not.toThrow();
    });
  });

  describe('abort', () => {
    it('should not throw when aborting without tasks', () => {
      expect(() => bgRemove.abort()).not.toThrow();
      expect(() => bgRemove.abort('some-id')).not.toThrow();
    });
  });
});
