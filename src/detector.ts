/**
 * browser-rmbg - Device Detector
 * Detects WebGPU / WebGL / WASM capabilities with three-level fallback.
 */

import type { DeviceCapabilities, DeviceType } from './types';

export class DeviceDetector {
  private static _cachedCapabilities?: DeviceCapabilities;

  /**
   * 检测设备能力
   * 优先级: WebGPU > WebGL > WASM
   */
  static async detect(): Promise<DeviceCapabilities> {
    if (this._cachedCapabilities) {
      return this._cachedCapabilities;
    }

    const isIOS = this.detectIOS();
    const isMobile = this.detectMobile();
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;

    // 并行检测三种能力
    const [webgpu, webgl, wasm] = await Promise.all([
      this.detectWebGPU(),
      this.detectWebGL(),
      this.detectWASM(),
    ]);

    // 确定推荐设备
    let recommended: DeviceType = 'wasm';
    if (webgpu.supported && !isIOS) {
      recommended = 'webgpu';
    } else if (webgl.supported && webgl.version >= 2) {
      recommended = 'webgl';
    }

    const capabilities: DeviceCapabilities = {
      webgpu,
      webgl,
      wasm,
      recommended,
      isIOS,
      isMobile,
      hardwareConcurrency,
    };

    this._cachedCapabilities = capabilities;
    return capabilities;
  }

  /** 清除缓存的检测结果 */
  static clearCache(): void {
    this._cachedCapabilities = undefined;
  }

  /**
   * 检测 WebGPU 能力
   */
  static async detectWebGPU(): Promise<DeviceCapabilities['webgpu']> {
    const gpu = (navigator as unknown as { gpu?: unknown }).gpu as
      | {
          requestAdapter: () => Promise<{
            info: { vendor: string };
            requestDevice: () => Promise<{ destroy: () => void }>;
          } | null>;
        }
      | undefined;

    if (!gpu) {
      return {
        supported: false,
        reason: 'WebGPU API not available in this browser',
      };
    }

    try {
      const adapter = await gpu.requestAdapter();
      if (!adapter) {
        return {
          supported: false,
          reason: 'WebGPU adapter request returned null',
        };
      }

      // 测试是否可以创建 device
      try {
        const device = await adapter.requestDevice();
        if (!device) {
          return {
            supported: false,
            reason: 'WebGPU device request returned null',
          };
        }
        device.destroy();
      } catch {
        return {
          supported: false,
          reason: 'Failed to create WebGPU device',
        };
      }

      return {
        supported: true,
        adapterInfo: adapter.info,
      };
    } catch (error) {
      return {
        supported: false,
        reason: `WebGPU detection error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 检测 WebGL 能力
   */
  static detectWebGL(): DeviceCapabilities['webgl'] {
    const canvas = document.createElement('canvas');

    // 尝试 WebGL2
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      const vendor = gl2.getParameter(gl2.VENDOR) as string | undefined;
      const renderer = gl2.getParameter(gl2.RENDERER) as string | undefined;
      return {
        supported: true,
        version: 2,
        vendor,
        renderer,
      };
    }

    // 回退到 WebGL1
    const gl1 = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl1) {
      const gl = gl1 as WebGLRenderingContext;
      const vendor = gl.getParameter(gl.VENDOR) as string | undefined;
      const renderer = gl.getParameter(gl.RENDERER) as string | undefined;
      return {
        supported: true,
        version: 1,
        vendor,
        renderer,
      };
    }

    return {
      supported: false,
      version: 0,
      reason: 'WebGL not supported in this browser',
    };
  }

  /**
   * 检测 WASM 能力
   */
  static detectWASM(): DeviceCapabilities['wasm'] {
    const supported = typeof WebAssembly === 'object';

    if (!supported) {
      return {
        supported: false,
        reason: 'WebAssembly not supported in this browser',
      };
    }

    // 检测 SIMD 支持
    let simd = false;
    try {
      simd = WebAssembly.validate(
        new Uint8Array([
          0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
          0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
          0x03, 0x02, 0x01, 0x00,
          0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41, 0x00, 0xfd, 0x0f, 0x1b, 0x0b,
        ])
      );
    } catch {
      // ignore
    }

    // 检测 Threads 支持
    let threads = false;
    try {
      threads = WebAssembly.validate(
        new Uint8Array([
          0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
          0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
          0x03, 0x02, 0x01, 0x00,
          0x05, 0x03, 0x01, 0x00, 0x01,
          0x0a, 0x07, 0x01, 0x05, 0x00, 0xfe, 0x00, 0x00, 0x0b,
        ])
      );
    } catch {
      // ignore
    }

    return {
      supported: true,
      simd,
      threads,
    };
  }

  /**
   * 检测 iOS 设备
   */
  static detectIOS(): boolean {
    const ua = navigator.userAgent;
    const platform = navigator.platform;

    const iosPlatforms = [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod',
    ];

    if (iosPlatforms.includes(platform)) return true;

    // iPad Pro detection: Mac UA + touch support + maxTouchPoints > 1
    return (
      ua.includes('Mac') &&
      'ontouchend' in document &&
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1
    );
  }

  /**
   * 检测移动设备
   */
  static detectMobile(): boolean {
    const ua = navigator.userAgent;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        ua
      ) ||
      (navigator.maxTouchPoints > 1 && 'ontouchend' in document)
    );
  }

  /**
   * 根据设备能力选择最佳设备类型
   * @param preference 用户偏好
   * @param capabilities 设备能力
   */
  static selectDevice(
    preference: DeviceType | undefined,
    capabilities: DeviceCapabilities
  ): DeviceType {
    if (preference) {
      // 验证用户偏好是否可用
      switch (preference) {
        case 'webgpu':
          if (capabilities.webgpu.supported && !capabilities.isIOS) {
            return 'webgpu';
          }
          break;
        case 'webgl':
          if (capabilities.webgl.supported) {
            return 'webgl';
          }
          break;
        case 'wasm':
          if (capabilities.wasm.supported) {
            return 'wasm';
          }
          break;
      }
    }

    // 按优先级自动选择
    if (capabilities.webgpu.supported && !capabilities.isIOS) {
      return 'webgpu';
    }
    if (capabilities.webgl.supported && capabilities.webgl.version >= 2) {
      return 'webgl';
    }
    return 'wasm';
  }

  /**
   * 获取设备能力摘要（用于日志和调试）
   */
  static getSummary(capabilities: DeviceCapabilities): string {
    const parts: string[] = [];
    parts.push(`Recommended: ${capabilities.recommended}`);
    parts.push(`WebGPU: ${capabilities.webgpu.supported ? '✓' : '✗'}${capabilities.webgpu.adapterInfo ? ` (${capabilities.webgpu.adapterInfo.vendor})` : ''}`);
    parts.push(`WebGL: ${capabilities.webgl.supported ? `✓ (v${capabilities.webgl.version})` : '✗'}`);
    parts.push(`WASM: ${capabilities.wasm.supported ? '✓' : '✗'}${capabilities.wasm.simd ? ' SIMD' : ''}${capabilities.wasm.threads ? ' Threads' : ''}`);
    parts.push(`iOS: ${capabilities.isIOS ? 'Yes' : 'No'}`);
    parts.push(`Mobile: ${capabilities.isMobile ? 'Yes' : 'No'}`);
    parts.push(`Cores: ${capabilities.hardwareConcurrency}`);
    return parts.join(' | ');
  }
}
