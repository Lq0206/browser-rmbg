/**
 * browser-rmbg - Type Definitions
 */

/** 支持的设备类型（三级降级） */
export type DeviceType = 'webgpu' | 'webgl' | 'wasm';

/** 模型标识 */
export type ModelId = 'briaai/RMBG-1.4' | 'Xenova/modnet';

/** 图片处理阶段 */
export type ProcessStage =
  | 'preparing'
  | 'preprocessing'
  | 'inferencing'
  | 'postprocessing'
  | 'exporting';

/** WebGPU 能力信息 */
export interface WebGPUCapability {
  supported: boolean;
  adapterInfo?: {
    vendor: string;
    architecture?: string;
    device?: string;
    description?: string;
  };
  reason?: string;
}

/** WebGL 能力信息 */
export interface WebGLCapability {
  supported: boolean;
  version: 1 | 2 | 0;
  vendor?: string;
  renderer?: string;
  reason?: string;
}

/** WASM 能力信息 */
export interface WASMCapability {
  supported: boolean;
  simd?: boolean;
  threads?: boolean;
  reason?: string;
}

/** 设备能力检测结果 */
export interface DeviceCapabilities {
  webgpu: WebGPUCapability;
  webgl: WebGLCapability;
  wasm: WASMCapability;
  /** 推荐的设备类型 */
  recommended: DeviceType;
  /** 是否为 iOS 设备 */
  isIOS: boolean;
  /** 是否为移动设备 */
  isMobile: boolean;
  /** 可用逻辑核心数 */
  hardwareConcurrency: number;
}

/** 初始化选项 */
export interface BGRemoveOptions {
  /** 偏好设备类型，默认自动检测 */
  devicePreference?: DeviceType;
  /** 偏好模型，默认自动选择 */
  modelPreference?: ModelId;
  /** 是否启用 IndexedDB 缓存，默认 true */
  enableCache?: boolean;
  /** Worker 数量，默认 navigator.hardwareConcurrency || 4 */
  maxWorkers?: number;
  /** 模型加载超时（毫秒），默认 120000 */
  modelLoadTimeout?: number;
  /** 处理超时（毫秒），默认 60000 */
  processTimeout?: number;
  /** 自定义模型配置 */
  modelConfig?: Partial<ModelConfig>;
  /** 自定义 Worker 脚本路径 */
  workerScript?: string;
}

/** 模型配置 */
export interface ModelConfig {
  /** 预处理尺寸 */
  size: { width: number; height: number };
  /** 是否归一化 */
  doNormalize: boolean;
  /** 是否填充 */
  doPad: boolean;
  /** 是否缩放 */
  doRescale: boolean;
  /** 是否调整大小 */
  doResize: boolean;
  /** 图像均值 */
  imageMean: [number, number, number];
  /** 图像标准差 */
  imageStd: [number, number, number];
  /** 重采样方式 */
  resample: number;
  /** 缩放因子 */
  rescaleFactor: number;
  /** 特征提取器类型 */
  featureExtractorType: string;
}

/** 初始化结果 */
export interface InitResult {
  success: boolean;
  device: DeviceType;
  model: ModelId;
  error?: Error;
}

/** 处理选项 */
export interface ProcessOptions {
  /** 输出格式 */
  format?: 'png' | 'webp' | 'jpeg';
  /** 输出质量（0-1，仅 webp/jpeg） */
  quality?: number;
  /** 目标宽度（可选，默认原尺寸） */
  targetWidth?: number;
  /** 目标高度（可选，默认原尺寸） */
  targetHeight?: number;
  /** 是否保持纵横比 */
  maintainAspectRatio?: boolean;
}

/** 批量处理选项 */
export interface BatchProcessOptions extends ProcessOptions {
  /** 是否并行处理 */
  parallel?: boolean;
  /** 最大并行数 */
  maxConcurrency?: number;
  /** 单张完成回调 */
  onItemComplete?: (result: ProcessResult, index: number) => void;
  /** 单张失败回调 */
  onItemError?: (error: Error, index: number) => void;
}

/** 处理结果 */
export interface ProcessResult {
  /** 任务 ID */
  taskId: string;
  /** 输出 Blob */
  blob: Blob;
  /** 输出文件名 */
  fileName: string;
  /** 原始尺寸 */
  originalSize: { width: number; height: number };
  /** 输出尺寸 */
  outputSize: { width: number; height: number };
  /** 处理耗时（毫秒） */
  duration: number;
  /** 使用的设备 */
  device: DeviceType;
  /** 使用的模型 */
  model: ModelId;
  /** 处理阶段耗时统计 */
  stageTimings: Record<ProcessStage, number>;
}

/** 任务状态 */
export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'aborted';

/** 任务信息 */
export interface TaskInfo {
  taskId: string;
  status: TaskStatus;
  fileName: string;
  progress: number;
  stage: ProcessStage;
  startTime?: number;
  endTime?: number;
  error?: Error;
}

/** Worker 任务类型 */
export type WorkerTaskType = 'init' | 'process' | 'terminate';

/** Worker 传入消息 */
export interface WorkerInputMessage {
  type: WorkerTaskType;
  taskId: string;
  payload?: unknown;
}

/** Worker 传出消息 */
export interface WorkerOutputMessage {
  type: 'progress' | 'complete' | 'error' | 'log';
  taskId: string;
  payload?: unknown;
}

/** 缓存元数据 */
export interface CacheEntry {
  modelId: string;
  version: string;
  size: number;
  timestamp: number;
  data: ArrayBuffer;
}

/** 事件映射 */
export interface BGRemoveEventMap {
  'device-detected': DeviceCapabilities;
  'model-loading': { modelId: ModelId; progress: number };
  'model-loaded': { modelId: ModelId; device: DeviceType };
  'model-load-error': { modelId: ModelId; error: Error };
  'task-start': { taskId: string; fileName: string };
  'task-progress': {
    taskId: string;
    stage: ProcessStage;
    progress: number;
  };
  'task-complete': ProcessResult;
  'task-error': { taskId: string; error: Error };
  'task-aborted': { taskId: string };
  'fallback': { from: DeviceType; to: DeviceType; reason: string };
}

/** 事件名称类型 */
export type BGRemoveEventName = keyof BGRemoveEventMap;
