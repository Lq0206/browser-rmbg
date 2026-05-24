/**
 * browser-rmbg - Device Detector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceDetector } from '../src/detector';
import type { DeviceCapabilities } from '../src/types';

describe('DeviceDetector', () => {
  beforeEach(() => {
    DeviceDetector.clearCache();
  });

  describe('detectWASM', () => {
    it('should detect WASM support', () => {
      const result = DeviceDetector.detectWASM();
      expect(result.supported).toBe(true);
    });
  });

  describe('detectWebGL', () => {
    it('should detect WebGL or WebGL2', () => {
      const result = DeviceDetector.detectWebGL();
      // jsdom 不支持 WebGL，所以应该是 false
      expect(result.supported).toBe(false);
    });
  });

  describe('detectIOS', () => {
    const originalUA = navigator.userAgent;
    const originalPlatform = navigator.platform;

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
      DeviceDetector.clearCache();
    });

    it('should not detect iOS on MacIntel', () => {
      const result = DeviceDetector.detectIOS();
      expect(result).toBe(false);
    });

    it('should detect iOS on iPhone', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: 'iPhone',
        configurable: true,
      });

      expect(DeviceDetector.detectIOS()).toBe(true);
    });
  });

  describe('detectMobile', () => {
    it('should not detect desktop as mobile', () => {
      expect(DeviceDetector.detectMobile()).toBe(false);
    });
  });

  describe('selectDevice', () => {
    const baseCapabilities: DeviceCapabilities = {
      webgpu: { supported: false, reason: 'test' },
      webgl: { supported: false, version: 0, reason: 'test' },
      wasm: { supported: true },
      recommended: 'wasm',
      isIOS: false,
      isMobile: false,
      hardwareConcurrency: 4,
    };

    it('should select webgpu when available and preferred', () => {
      const caps: DeviceCapabilities = {
        ...baseCapabilities,
        webgpu: { supported: true },
        recommended: 'webgpu',
      };
      expect(DeviceDetector.selectDevice('webgpu', caps)).toBe('webgpu');
    });

    it('should fall back to wasm when webgpu not available', () => {
      expect(DeviceDetector.selectDevice('webgpu', baseCapabilities)).toBe('wasm');
    });

    it('should auto-select webgpu when no preference', () => {
      const caps: DeviceCapabilities = {
        ...baseCapabilities,
        webgpu: { supported: true },
        recommended: 'webgpu',
      };
      expect(DeviceDetector.selectDevice(undefined, caps)).toBe('webgpu');
    });

    it('should auto-select wasm when no GPU available', () => {
      expect(DeviceDetector.selectDevice(undefined, baseCapabilities)).toBe('wasm');
    });

    it('should force wasm on iOS even when webgpu available', () => {
      const caps: DeviceCapabilities = {
        ...baseCapabilities,
        webgpu: { supported: true },
        isIOS: true,
        recommended: 'wasm',
      };
      expect(DeviceDetector.selectDevice('webgpu', caps)).toBe('wasm');
    });
  });

  describe('getSummary', () => {
    it('should return a readable summary', () => {
      const caps: DeviceCapabilities = {
        webgpu: { supported: true, adapterInfo: { vendor: 'Apple' } },
        webgl: { supported: true, version: 2, vendor: 'Apple', renderer: 'Apple GPU' },
        wasm: { supported: true, simd: true, threads: true },
        recommended: 'webgpu',
        isIOS: false,
        isMobile: false,
        hardwareConcurrency: 8,
      };

      const summary = DeviceDetector.getSummary(caps);
      expect(summary).toContain('Recommended: webgpu');
      expect(summary).toContain('WebGPU: ✓');
      expect(summary).toContain('WebGL: ✓ (v2)');
      expect(summary).toContain('WASM: ✓ SIMD Threads');
      expect(summary).toContain('Cores: 8');
    });
  });
});
