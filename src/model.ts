/**
 * browser-rmbg - Model Manager
 * Handles model selection, loading, switching, and device fallback.
 */

import type {
  ModelId,
  DeviceType,
  ModelConfig,
  InitResult,
} from './types';
import { DeviceDetector } from './detector';
import { ModelCache } from './cache';
import { EventBus } from './events';
import { WorkerPool } from './worker/manager';
import {
  MODEL_IDS,
  MODEL_CONFIGS,
  MODEL_DEVICE_MAP,
  DEFAULT_TIMEOUTS,
  generateCacheVersion,
} from './constants';
import { withTimeout, createAbortController } from './utils';

export interface ModelManagerOptions {
  eventBus: EventBus;
  cache?: ModelCache;
  workerPool: WorkerPool;
  modelLoadTimeout?: number;
}

export class ModelManager {
  private eventBus: EventBus;
  private cache?: ModelCache;
  private workerPool: WorkerPool;
  private modelLoadTimeout: number;

  private currentModel: ModelId | null = null;
  private currentDevice: DeviceType | null = null;
  private currentConfig: ModelConfig | null = null;
  private initialized = false;

  constructor(options: ModelManagerOptions) {
    this.eventBus = options.eventBus;
    this.cache = options.cache;
    this.workerPool = options.workerPool;
    this.modelLoadTimeout = options.modelLoadTimeout || DEFAULT_TIMEOUTS.modelLoad;
  }

  /**
   * 初始化模型
   * @param preference 设备偏好
   * @param modelPreference 模型偏好
   */
  async initialize(
    preference?: DeviceType,
    modelPreference?: ModelId
  ): Promise<InitResult> {
    // 检测设备能力
    const capabilities = await DeviceDetector.detect();
    this.eventBus.emit('device-detected', capabilities);

    // 选择设备
    let device = DeviceDetector.selectDevice(preference, capabilities);

    // iOS 强制使用 WASM
    if (capabilities.isIOS) {
      device = 'wasm';
    }

    // 选择模型
    let model: ModelId;
    if (modelPreference) {
      model = modelPreference;
      // 验证模型与设备兼容性
      const recommendedDevice = MODEL_DEVICE_MAP[model];
      if (recommendedDevice === 'webgpu' && device !== 'webgpu') {
        // MODNet 需要 WebGPU，如果不支持则降级模型
        model = MODEL_IDS.RMBG;
        this.eventBus.emit('fallback', {
          from: device,
          to: 'wasm',
          reason: `Model ${modelPreference} requires WebGPU, falling back to ${model} with WASM`,
        });
        device = 'wasm';
      }
    } else {
      // 自动选择模型
      model = device === 'webgpu' ? MODEL_IDS.MODNET : MODEL_IDS.RMBG;
    }

    const config = MODEL_CONFIGS[model];

    // 尝试从缓存加载
    const cacheVersion = generateCacheVersion(model);
    const cached = await this.cache?.has(model, cacheVersion);

    if (cached) {
      this.eventBus.emit('model-loading', { modelId: model, progress: 0.5 });
    }

    // 加载模型到 Worker
    this.eventBus.emit('model-loading', { modelId: model, progress: 0 });

    const { controller, clear } = createAbortController(this.modelLoadTimeout);

    try {
      await withTimeout(
        this.workerPool.initModel(model, device, config, controller.signal),
        this.modelLoadTimeout,
        `Model initialization (${model})`
      );

      clear();

      this.currentModel = model;
      this.currentDevice = device;
      this.currentConfig = config;
      this.initialized = true;

      this.eventBus.emit('model-loading', { modelId: model, progress: 1 });
      this.eventBus.emit('model-loaded', { modelId: model, device });

      return {
        success: true,
        device,
        model,
      };
    } catch (error) {
      clear();

      // 尝试降级
      if (device === 'webgpu') {
        this.eventBus.emit('fallback', {
          from: 'webgpu',
          to: 'wasm',
          reason: `WebGPU model loading failed: ${error instanceof Error ? error.message : String(error)}`,
        });
        return this.initialize('wasm', MODEL_IDS.RMBG);
      }

      if (device === 'webgl') {
        this.eventBus.emit('fallback', {
          from: 'webgl',
          to: 'wasm',
          reason: `WebGL model loading failed: ${error instanceof Error ? error.message : String(error)}`,
        });
        return this.initialize('wasm', MODEL_IDS.RMBG);
      }

      this.eventBus.emit('model-load-error', {
        modelId: model,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return {
        success: false,
        device,
        model,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 切换模型
   */
  async switchModel(modelId: ModelId): Promise<InitResult> {
    if (!this.initialized) {
      throw new Error('ModelManager not initialized. Call initialize() first.');
    }

    if (this.currentModel === modelId) {
      return {
        success: true,
        device: this.currentDevice!,
        model: modelId,
      };
    }

    // 重新初始化
    this.initialized = false;
    return this.initialize(this.currentDevice || undefined, modelId);
  }

  /**
   * 切换设备
   */
  async switchDevice(device: DeviceType): Promise<InitResult> {
    if (!this.initialized) {
      throw new Error('ModelManager not initialized. Call initialize() first.');
    }

    if (this.currentDevice === device) {
      return {
        success: true,
        device,
        model: this.currentModel!,
      };
    }

    // 重新初始化
    this.initialized = false;
    return this.initialize(device, this.currentModel || undefined);
  }

  /**
   * 预加载模型（用于缓存预热）
   */
  async preloadModel(modelId?: ModelId): Promise<void> {
    const targetModel = modelId || MODEL_IDS.RMBG;
    // 这里可以下载模型文件并存入 IndexedDB
    // 实际实现需要调用 transformers.js 的下载逻辑
    this.eventBus.emit('model-loading', { modelId: targetModel, progress: 0 });
    // 模拟预加载完成
    this.eventBus.emit('model-loading', { modelId: targetModel, progress: 1 });
  }

  /** 获取当前模型 */
  getCurrentModel(): ModelId | null {
    return this.currentModel;
  }

  /** 获取当前设备 */
  getCurrentDevice(): DeviceType | null {
    return this.currentDevice;
  }

  /** 获取当前配置 */
  getCurrentConfig(): ModelConfig | null {
    return this.currentConfig;
  }

  /** 是否已初始化 */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** 销毁 */
  destroy(): void {
    this.initialized = false;
    this.currentModel = null;
    this.currentDevice = null;
    this.currentConfig = null;
  }
}
