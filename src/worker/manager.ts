/**
 * browser-rmbg - Worker Pool Manager
 * Manages a pool of Web Workers for model inference with abort support.
 */

import type {
  WorkerWrapper,
  WorkerInputMessage,
  WorkerOutputMessage,
  InitPayload,
  ProcessPayload,
  AbortPayload,
  ProgressPayload,
  CompletePayload,
  ErrorPayload,
} from './types';
import type { ProcessOptions, ProcessResult, ProcessStage, ModelId, DeviceType, ModelConfig } from '../types';
import { generateTaskId } from '../constants';

export interface WorkerPoolOptions {
  maxWorkers?: number;
  workerScript?: string;
}

export class WorkerPool {
  private workers: WorkerWrapper[] = [];
  private taskQueue: Array<{
    taskId: string;
    message: WorkerInputMessage;
    resolve: (value: ProcessResult) => void;
    reject: (reason: Error) => void;
    onProgress?: (stage: ProcessStage, progress: number) => void;
  }> = [];
  private maxWorkers: number;
  private workerScript: string;
  private terminated = false;

  constructor(options: WorkerPoolOptions = {}) {
    this.maxWorkers = options.maxWorkers || (navigator.hardwareConcurrency || 4);
    this.workerScript = options.workerScript || this.getDefaultWorkerScript();
  }

  /**
   * 获取默认 Worker 脚本路径
   * 在实际构建中，需要确保 worker.js 文件可被访问
   */
  private getDefaultWorkerScript(): string {
    // 尝试从当前模块路径推断
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const baseUrl = new URL(/* @vite-ignore */ '.', import.meta.url).href;
      return new URL(/* @vite-ignore */ 'worker.js', baseUrl).href;
    }
    return './worker.js';
  }

  /**
   * 获取或创建可用 Worker
   */
  private getOrCreateWorker(): WorkerWrapper {
    // 查找空闲 Worker
    const idle = this.workers.find(w => w.state === 'idle');
    if (idle) return idle;

    // 未达上限则创建新 Worker
    if (this.workers.length < this.maxWorkers) {
      return this.createWorker();
    }

    // 等待队列处理
    throw new Error('All workers are busy');
  }

  /**
   * 创建新 Worker
   */
  private createWorker(): WorkerWrapper {
    const id = this.workers.length;
    const worker = new Worker(this.workerScript, { type: 'module' });

    const wrapper: WorkerWrapper = {
      id,
      worker,
      state: 'idle',
      currentTaskId: null,
      pendingAbort: false,
    };

    worker.onmessage = (e: MessageEvent<WorkerOutputMessage>) => {
      this.handleWorkerMessage(wrapper, e.data);
    };

    worker.onerror = (error) => {
      console.error(`[Worker ${id}] Error:`, error);
      if (wrapper.currentTaskId) {
        this.rejectTask(wrapper.currentTaskId, new Error(`Worker error: ${error.message}`));
      }
      wrapper.state = 'idle';
      wrapper.currentTaskId = null;
      this.processQueue();
    };

    this.workers.push(wrapper);
    return wrapper;
  }

  /**
   * 处理 Worker 消息
   */
  private handleWorkerMessage(
    wrapper: WorkerWrapper,
    message: WorkerOutputMessage
  ): void {
    const { type, taskId } = message;

    switch (type) {
      case 'progress': {
        const payload = message.payload as ProgressPayload;
        this.notifyProgress(taskId, payload.stage, payload.progress);
        break;
      }
      case 'complete': {
        const payload = message.payload as CompletePayload;
        const result: ProcessResult = {
          ...payload.result,
          taskId,
          device: 'wasm', // 会在 processor 中覆盖
          model: 'briaai/RMBG-1.4', // 会在 processor 中覆盖
        };
        this.resolveTask(taskId, result);
        wrapper.state = 'idle';
        wrapper.currentTaskId = null;
        wrapper.pendingAbort = false;
        this.processQueue();
        break;
      }
      case 'error': {
        const payload = message.payload as ErrorPayload;
        this.rejectTask(taskId, new Error(payload.message));
        wrapper.state = 'idle';
        wrapper.currentTaskId = null;
        wrapper.pendingAbort = false;
        this.processQueue();
        break;
      }
      case 'log': {
        // 仅透传日志，不做处理
        break;
      }
      case 'model-loaded': {
        // 模型加载完成通知
        break;
      }
    }
  }

  /**
   * 通知任务进度
   */
  private notifyProgress(
    taskId: string,
    stage: ProcessStage,
    progress: number
  ): void {
    const queued = this.taskQueue.find(q => q.taskId === taskId);
    if (queued?.onProgress) {
      queued.onProgress(stage, progress);
    }
  }

  /**
   * 完成任务
   */
  private resolveTask(taskId: string, result: ProcessResult): void {
    const index = this.taskQueue.findIndex(q => q.taskId === taskId);
    if (index !== -1) {
      const { resolve } = this.taskQueue[index];
      this.taskQueue.splice(index, 1);
      resolve(result);
    }
  }

  /**
   * 拒绝任务
   */
  private rejectTask(taskId: string, error: Error): void {
    const index = this.taskQueue.findIndex(q => q.taskId === taskId);
    if (index !== -1) {
      const { reject } = this.taskQueue[index];
      this.taskQueue.splice(index, 1);
      reject(error);
    }
  }

  /**
   * 处理队列中的任务
   */
  private processQueue(): void {
    if (this.terminated) return;

    const pending = this.taskQueue.find(q => {
      return !this.workers.some(w => w.currentTaskId === q.taskId);
    });

    if (!pending) return;

    try {
      const worker = this.getOrCreateWorker();
      worker.state = 'busy';
      worker.currentTaskId = pending.taskId;
      worker.worker.postMessage(pending.message);
    } catch {
      // 所有 Worker 都忙，等待
    }
  }

  /**
   * 初始化 Worker 中的模型
   */
  async initModel(
    modelId: ModelId,
    device: DeviceType,
    modelConfig: ModelConfig,
    signal?: AbortSignal
  ): Promise<void> {
    if (this.terminated) {
      throw new Error('WorkerPool has been terminated');
    }

    const taskId = generateTaskId();

    return new Promise((resolve, reject) => {
      const abortHandler = () => {
        reject(new Error('Model initialization aborted'));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler);
      }

      // 使用第一个 Worker 加载模型
      const worker = this.getOrCreateWorker();
      worker.state = 'busy';
      worker.currentTaskId = taskId;

      const originalOnMessage = worker.worker.onmessage;
      worker.worker.onmessage = (e: MessageEvent<WorkerOutputMessage>) => {
        const { type } = e.data;

        if (type === 'model-loaded' || type === 'complete') {
          worker.worker.onmessage = originalOnMessage;
          worker.state = 'idle';
          worker.currentTaskId = null;
          if (signal) signal.removeEventListener('abort', abortHandler);
          resolve();
        } else if (type === 'error') {
          worker.worker.onmessage = originalOnMessage;
          worker.state = 'idle';
          worker.currentTaskId = null;
          if (signal) signal.removeEventListener('abort', abortHandler);
          const payload = e.data.payload as ErrorPayload;
          reject(new Error(payload.message));
        } else {
          // 其他消息透传给原始处理器
          if (originalOnMessage) {
            originalOnMessage.call(worker.worker, e);
          }
        }
      };

      const message: WorkerInputMessage = {
        type: 'init',
        taskId,
        payload: {
          modelId,
          device,
          modelConfig,
        } as InitPayload,
      };

      worker.worker.postMessage(message);
    });
  }

  /**
   * 提交处理任务
   */
  async process(
    imageBuffer: ArrayBuffer,
    fileName: string,
    modelId: ModelId,
    device: DeviceType,
    modelConfig: ModelConfig,
    options: ProcessOptions = {},
    onProgress?: (stage: ProcessStage, progress: number) => void,
    signal?: AbortSignal
  ): Promise<ProcessResult> {
    if (this.terminated) {
      throw new Error('WorkerPool has been terminated');
    }

    const taskId = generateTaskId();

    return new Promise((resolve, reject) => {
      const abortHandler = () => {
        this.abortTask(taskId);
        reject(new Error('Processing aborted'));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler);
      }

      const message: WorkerInputMessage = {
        type: 'process',
        taskId,
        payload: {
          imageBuffer,
          fileName,
          modelId,
          device,
          modelConfig,
          options,
        } as ProcessPayload,
      };

      this.taskQueue.push({
        taskId,
        message,
        resolve: (result) => {
          if (signal) signal.removeEventListener('abort', abortHandler);
          resolve(result);
        },
        reject: (error) => {
          if (signal) signal.removeEventListener('abort', abortHandler);
          reject(error);
        },
        onProgress,
      });

      this.processQueue();
    });
  }

  /**
   * 终止指定任务
   */
  abortTask(taskId: string): void {
    // 从队列中移除
    const queueIndex = this.taskQueue.findIndex(q => q.taskId === taskId);
    if (queueIndex !== -1) {
      const { reject } = this.taskQueue[queueIndex];
      this.taskQueue.splice(queueIndex, 1);
      reject(new Error('Task aborted'));
      return;
    }

    // 向 Worker 发送终止信号
    const worker = this.workers.find(w => w.currentTaskId === taskId);
    if (worker) {
      worker.pendingAbort = true;
      const message: WorkerInputMessage = {
        type: 'abort',
        taskId,
        payload: { taskId } as AbortPayload,
      };
      worker.worker.postMessage(message);
    }
  }

  /**
   * 终止所有 Worker
   */
  terminate(): void {
    this.terminated = true;

    // 拒绝所有队列中的任务
    for (const queued of this.taskQueue) {
      queued.reject(new Error('WorkerPool terminated'));
    }
    this.taskQueue = [];

    // 终止所有 Worker
    for (const worker of this.workers) {
      worker.state = 'terminated';
      worker.worker.terminate();
    }
    this.workers = [];
  }

  /**
   * 获取 Worker 状态
   */
  getStatus(): {
    totalWorkers: number;
    idleWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      idleWorkers: this.workers.filter(w => w.state === 'idle').length,
      busyWorkers: this.workers.filter(w => w.state === 'busy').length,
      queuedTasks: this.taskQueue.filter(q =>
        !this.workers.some(w => w.currentTaskId === q.taskId)
      ).length,
    };
  }
}
