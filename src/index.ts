/**
 * browser-rmbg - Main Entry Point
 * High-performance AI background removal in the browser.
 */

import type {
  BGRemoveOptions,
  InitResult,
  ProcessOptions,
  ProcessResult,
  BatchProcessOptions,
  DeviceType,
  ModelId,
  DeviceCapabilities,
  BGRemoveEventName,
  BGRemoveEventMap,
} from './types';
import { DeviceDetector } from './detector';
import { ModelCache } from './cache';
import { EventBus } from './events';
import { WorkerPool } from './worker/manager';
import { ModelManager } from './model';
import { Processor } from './processor';
import { DEFAULT_MAX_WORKERS, DEFAULT_TIMEOUTS } from './constants';

export type {
  BGRemoveOptions,
  InitResult,
  ProcessOptions,
  ProcessResult,
  BatchProcessOptions,
  DeviceType,
  ModelId,
  DeviceCapabilities,
  BGRemoveEventName,
  BGRemoveEventMap,
  TaskInfo,
  ProcessStage,
  ModelConfig,
} from './types';

export { DeviceDetector } from './detector';
export { ModelCache } from './cache';
export { EventBus } from './events';
export { WorkerPool } from './worker/manager';
export { ModelManager } from './model';
export { Processor } from './processor';

export type { WorkerPoolOptions } from './worker/manager';
export type { ModelManagerOptions } from './model';
export type { ProcessorOptions } from './processor';

/**
 * BGRemove 主类
 * 统一的背景移除处理入口，整合设备检测、模型管理、Worker 池和事件系统
 */
export class BGRemove {
  private options: Required<Omit<BGRemoveOptions, 'workerScript'>> & Pick<BGRemoveOptions, 'workerScript'>;
  private eventBus: EventBus;
  private cache?: ModelCache;
  private workerPool: WorkerPool;
  private modelManager: ModelManager;
  private processor: Processor;
  private destroyed = false;

  constructor(options: BGRemoveOptions = {}) {
    this.options = {
      devicePreference: options.devicePreference ?? undefined as unknown as DeviceType,
      modelPreference: options.modelPreference ?? undefined as unknown as ModelId,
      enableCache: options.enableCache ?? true,
      maxWorkers: options.maxWorkers ?? DEFAULT_MAX_WORKERS,
      modelLoadTimeout: options.modelLoadTimeout ?? DEFAULT_TIMEOUTS.modelLoad,
      processTimeout: options.processTimeout ?? DEFAULT_TIMEOUTS.process,
      modelConfig: options.modelConfig ?? {},
      workerScript: options.workerScript ?? '',
    };

    this.eventBus = new EventBus();

    if (this.options.enableCache) {
      this.cache = new ModelCache();
    }

    this.workerPool = new WorkerPool({
      maxWorkers: this.options.maxWorkers,
      workerScript: this.options.workerScript,
    });

    this.modelManager = new ModelManager({
      eventBus: this.eventBus,
      cache: this.cache,
      workerPool: this.workerPool,
      modelLoadTimeout: this.options.modelLoadTimeout,
    });

    this.processor = new Processor({
      eventBus: this.eventBus,
      workerPool: this.workerPool,
      processTimeout: this.options.processTimeout,
      getCurrentModel: () => this.modelManager.getCurrentModel(),
      getCurrentDevice: () => this.modelManager.getCurrentDevice(),
      getCurrentConfig: () => this.modelManager.getCurrentConfig(),
    });
  }

  /**
   * 初始化系统
   * @param devicePreference 可选的设备偏好
   * @returns 初始化结果
   */
  async initialize(devicePreference?: DeviceType): Promise<InitResult> {
    this.checkDestroyed();

    const preference = devicePreference || this.options.devicePreference;
    return this.modelManager.initialize(preference, this.options.modelPreference);
  }

  /**
   * 检测设备能力（静态方法）
   */
  static async detectDevices(): Promise<DeviceCapabilities> {
    return DeviceDetector.detect();
  }

  /**
   * 处理单张图片
   * @param image 输入图片
   * @param options 处理选项
   * @returns 处理结果
   */
  async process(
    image: File | Blob,
    options?: ProcessOptions
  ): Promise<ProcessResult> {
    this.checkDestroyed();
    return this.processor.process(image, options);
  }

  /**
   * 批量处理图片
   * @param images 输入图片数组
   * @param options 批量处理选项
   * @returns 处理结果数组
   */
  async processBatch(
    images: (File | Blob)[],
    options?: BatchProcessOptions
  ): Promise<ProcessResult[]> {
    this.checkDestroyed();
    return this.processor.processBatch(images, options);
  }

  /**
   * 终止任务
   * @param taskId 任务 ID，不传则终止所有任务
   */
  abort(taskId?: string): void {
    if (taskId) {
      this.processor.abort(taskId);
    } else {
      this.processor.abortAll();
    }
  }

  /**
   * 切换模型
   * @param modelId 模型 ID
   */
  async switchModel(modelId: ModelId): Promise<InitResult> {
    this.checkDestroyed();
    return this.modelManager.switchModel(modelId);
  }

  /**
   * 切换设备
   * @param device 设备类型
   */
  async switchDevice(device: DeviceType): Promise<InitResult> {
    this.checkDestroyed();
    return this.modelManager.switchDevice(device);
  }

  /**
   * 预加载模型
   * @param modelId 模型 ID，不传则使用默认模型
   */
  async preloadModel(modelId?: ModelId): Promise<void> {
    this.checkDestroyed();
    return this.modelManager.preloadModel(modelId);
  }

  /**
   * 清空模型缓存
   */
  async clearCache(): Promise<void> {
    await this.cache?.clear();
  }

  /**
   * 获取设备能力
   */
  async getCapabilities(): Promise<DeviceCapabilities> {
    return DeviceDetector.detect();
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    initialized: boolean;
    model: ModelId | null;
    device: DeviceType | null;
    workers: ReturnType<WorkerPool['getStatus']>;
    tasks: ReturnType<Processor['getAllTasks']>;
  } {
    return {
      initialized: this.modelManager.isInitialized(),
      model: this.modelManager.getCurrentModel(),
      device: this.modelManager.getCurrentDevice(),
      workers: this.workerPool.getStatus(),
      tasks: this.processor.getAllTasks(),
    };
  }

  /**
   * 注册事件监听器
   * @param event 事件名称
   * @param handler 事件处理器
   * @returns 取消订阅函数
   */
  on<K extends BGRemoveEventName>(
    event: K,
    handler: (payload: BGRemoveEventMap[K]) => void
  ): () => void {
    return this.eventBus.on(event, handler as (payload: unknown) => void);
  }

  /**
   * 移除事件监听器
   */
  off<K extends BGRemoveEventName>(
    event: K,
    handler: (payload: BGRemoveEventMap[K]) => void
  ): void {
    this.eventBus.off(event, handler as (payload: unknown) => void);
  }

  /**
   * 一次性事件监听
   */
  once<K extends BGRemoveEventName>(
    event: K,
    handler: (payload: BGRemoveEventMap[K]) => void
  ): () => void {
    return this.eventBus.once(event, handler as (payload: unknown) => void);
  }

  /**
   * 等待某个事件
   */
  waitFor<K extends BGRemoveEventName>(
    event: K,
    timeoutMs?: number
  ): Promise<BGRemoveEventMap[K]> {
    return this.eventBus.waitFor(event, timeoutMs) as Promise<BGRemoveEventMap[K]>;
  }

  /**
   * 销毁实例，释放所有资源
   */
  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;
    this.processor.destroy();
    this.modelManager.destroy();
    this.workerPool.terminate();
    this.cache?.destroy();
    this.eventBus.clear();
  }

  /**
   * 检查实例是否已销毁
   */
  private checkDestroyed(): void {
    if (this.destroyed) {
      throw new Error('BGRemove instance has been destroyed');
    }
  }
}

export default BGRemove;
