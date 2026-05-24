/**
 * browser-rmbg - Image Processor
 * Orchestrates image processing with abort support and fallback handling.
 */

import type {
  ProcessOptions,
  ProcessResult,
  TaskInfo,
  ModelId,
  DeviceType,
  ModelConfig,
  BatchProcessOptions,
} from './types';
import { EventBus } from './events';
import { WorkerPool } from './worker/manager';
import { generateTaskId } from './constants';
import {
  blobToArrayBuffer,
  createAbortController,
  runWithConcurrency,
} from './utils';

export interface ProcessorOptions {
  eventBus: EventBus;
  workerPool: WorkerPool;
  processTimeout?: number;
  getCurrentModel: () => ModelId | null;
  getCurrentDevice: () => DeviceType | null;
  getCurrentConfig: () => ModelConfig | null;
}

export class Processor {
  private eventBus: EventBus;
  private workerPool: WorkerPool;
  private processTimeout: number;
  private getCurrentModel: () => ModelId | null;
  private getCurrentDevice: () => DeviceType | null;
  private getCurrentConfig: () => ModelConfig | null;

  private tasks: Map<string, TaskInfo> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(options: ProcessorOptions) {
    this.eventBus = options.eventBus;
    this.workerPool = options.workerPool;
    this.processTimeout = options.processTimeout || 60000;
    this.getCurrentModel = options.getCurrentModel;
    this.getCurrentDevice = options.getCurrentDevice;
    this.getCurrentConfig = options.getCurrentConfig;
  }

  /**
   * 处理单张图片
   * @param image 输入图片（File 或 Blob）
   * @param options 处理选项
   * @param signal 外部 AbortSignal
   */
  async process(
    image: File | Blob,
    options: ProcessOptions = {},
    signal?: AbortSignal
  ): Promise<ProcessResult> {
    const modelId = this.getCurrentModel();
    const device = this.getCurrentDevice();
    const config = this.getCurrentConfig();

    if (!modelId || !device || !config) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const taskId = generateTaskId();
    const fileName = image instanceof File ? image.name : 'image.png';

    // 创建 AbortController
    const { controller, clear } = createAbortController(this.processTimeout);
    this.abortControllers.set(taskId, controller);

    // 关联外部 signal
    if (signal) {
      signal.addEventListener('abort', () => {
        controller.abort(signal.reason);
      });
    }

    // 注册任务
    const taskInfo: TaskInfo = {
      taskId,
      status: 'running',
      fileName,
      progress: 0,
      stage: 'preparing',
      startTime: Date.now(),
    };
    this.tasks.set(taskId, taskInfo);

    this.eventBus.emit('task-start', { taskId, fileName });

    try {
      // 读取图片为 ArrayBuffer
      const imageBuffer = await blobToArrayBuffer(image);

      // 检查是否已中止
      if (controller.signal.aborted) {
        throw new Error(controller.signal.reason?.message || 'Task aborted');
      }

      // 提交到 Worker Pool
      const result = await this.workerPool.process(
        imageBuffer,
        fileName,
        modelId,
        device,
        config,
        options,
        (stage, progress) => {
          taskInfo.stage = stage;
          taskInfo.progress = progress;
          this.eventBus.emit('task-progress', { taskId, stage, progress });
        },
        controller.signal
      );

      // 补全结果信息
      const fullResult: ProcessResult = {
        ...result,
        taskId,
        device,
        model: modelId,
      };

      taskInfo.status = 'completed';
      taskInfo.endTime = Date.now();
      taskInfo.progress = 100;

      this.eventBus.emit('task-complete', fullResult);

      return fullResult;
    } catch (error) {
      taskInfo.status = 'failed';
      taskInfo.endTime = Date.now();
      taskInfo.error = error instanceof Error ? error : new Error(String(error));

      this.eventBus.emit('task-error', {
        taskId,
        error: taskInfo.error,
      });

      throw error;
    } finally {
      clear();
      this.abortControllers.delete(taskId);
      // 保留任务信息供查询，但限制数量
      this.cleanupTasks();
    }
  }

  /**
   * 批量处理图片
   */
  async processBatch(
    images: (File | Blob)[],
    options: BatchProcessOptions = {}
  ): Promise<ProcessResult[]> {
    const {
      parallel = true,
      maxConcurrency = 4,
      onItemComplete,
      onItemError,
      ...processOptions
    } = options;

    if (!parallel) {
      // 串行处理
      const results: ProcessResult[] = [];
      for (let i = 0; i < images.length; i++) {
        try {
          const result = await this.process(images[i], processOptions);
          results[i] = result;
          onItemComplete?.(result, i);
        } catch (error) {
          onItemError?.(error instanceof Error ? error : new Error(String(error)), i);
        }
      }
      return results;
    }

    // 并行处理（限制并发数）
    const tasks = images.map((image, index) => async () => {
      try {
        const result = await this.process(image, processOptions);
        onItemComplete?.(result, index);
        return result;
      } catch (error) {
        onItemError?.(error instanceof Error ? error : new Error(String(error)), index);
        throw error;
      }
    });

    const results = await runWithConcurrency(tasks, maxConcurrency);
    return results.filter((r): r is ProcessResult => r !== undefined);
  }

  /**
   * 终止指定任务
   */
  abort(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort(new Error('Task aborted by user'));
      this.workerPool.abortTask(taskId);

      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'aborted';
        task.endTime = Date.now();
        this.eventBus.emit('task-aborted', { taskId });
      }

      return true;
    }
    return false;
  }

  /**
   * 终止所有任务
   */
  abortAll(): void {
    for (const [taskId, controller] of this.abortControllers) {
      controller.abort(new Error('All tasks aborted'));
      this.workerPool.abortTask(taskId);

      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'aborted';
        task.endTime = Date.now();
        this.eventBus.emit('task-aborted', { taskId });
      }
    }
    this.abortControllers.clear();
  }

  /**
   * 获取任务信息
   */
  getTask(taskId: string): TaskInfo | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): TaskInfo[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 清理旧任务记录
   */
  private cleanupTasks(): void {
    const maxTasks = 100;
    if (this.tasks.size > maxTasks) {
      const sorted = Array.from(this.tasks.entries()).sort(
        (a, b) => (b[1].endTime || 0) - (a[1].endTime || 0)
      );
      const toRemove = sorted.slice(maxTasks);
      for (const [id] of toRemove) {
        this.tasks.delete(id);
      }
    }
  }

  /**
   * 销毁处理器
   */
  destroy(): void {
    this.abortAll();
    this.tasks.clear();
  }
}
