/**
 * browser-rmbg - Worker Communication Types
 */

import type {
  ModelId,
  ModelConfig,
  ProcessOptions,
  ProcessResult,
  ProcessStage,
  DeviceType,
} from '../types';

/** Worker 任务类型 */
export type WorkerTaskType = 'init' | 'process' | 'abort' | 'terminate';

/** Worker 传入消息 */
export interface WorkerInputMessage {
  type: WorkerTaskType;
  taskId: string;
  payload?: InitPayload | ProcessPayload | AbortPayload;
}

/** 初始化负载 */
export interface InitPayload {
  modelId: ModelId;
  device: DeviceType;
  modelConfig: ModelConfig;
}

/** 处理负载 */
export interface ProcessPayload {
  imageBuffer: ArrayBuffer;
  fileName: string;
  options: ProcessOptions;
  modelId: ModelId;
  device: DeviceType;
  modelConfig: ModelConfig;
}

/** 终止负载 */
export interface AbortPayload {
  taskId: string;
}

/** Worker 传出消息类型 */
export type WorkerOutputType =
  | 'progress'
  | 'complete'
  | 'error'
  | 'log'
  | 'model-loaded';

/** Worker 传出消息 */
export interface WorkerOutputMessage {
  type: WorkerOutputType;
  taskId: string;
  payload?: ProgressPayload | CompletePayload | ErrorPayload | LogPayload | ModelLoadedPayload;
}

/** 进度负载 */
export interface ProgressPayload {
  stage: ProcessStage;
  progress: number;
}

/** 完成负载 */
export interface CompletePayload {
  result: Omit<ProcessResult, 'taskId' | 'duration' | 'device' | 'model' | 'stageTimings'> & {
    duration: number;
    stageTimings: Record<ProcessStage, number>;
  };
}

/** 错误负载 */
export interface ErrorPayload {
  message: string;
  stack?: string;
}

/** 日志负载 */
export interface LogPayload {
  level: 'log' | 'warn' | 'error';
  message: string;
}

/** 模型加载完成负载 */
export interface ModelLoadedPayload {
  modelId: ModelId;
  device: DeviceType;
}

/** Worker 状态 */
export type WorkerState = 'idle' | 'busy' | 'terminated';

/** Worker 包装器接口 */
export interface WorkerWrapper {
  id: number;
  worker: Worker;
  state: WorkerState;
  currentTaskId: string | null;
  pendingAbort: boolean;
}
