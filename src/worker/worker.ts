/**
 * browser-rmbg - Worker Script
 * Runs in a Web Worker to offload model inference from the main thread.
 *
 * This worker handles:
 * - Model initialization with Transformers.js
 * - Image pre/post-processing
 * - ONNX inference
 * - Progress reporting
 */

import type {
  WorkerInputMessage,
  WorkerOutputMessage,
  InitPayload,
  ProcessPayload,
  AbortPayload,
} from './types';
import type { ProcessStage } from '../types';

// 在 Worker 中动态导入 transformers
// 注意：实际使用时需要确保构建系统正确处理 Worker 中的外部依赖
let transformersModule: typeof import('@huggingface/transformers') | null = null;

/** 当前任务状态 */
let currentTaskId: string | null = null;
let abortRequested = false;

/**
 * 发送消息到主线程
 */
function post(type: WorkerOutputMessage['type'], taskId: string, payload?: unknown): void {
  self.postMessage({ type, taskId, payload } as WorkerOutputMessage);
}

/**
 * 发送进度更新
 */
function reportProgress(taskId: string, stage: ProcessStage, progress: number): void {
  post('progress', taskId, { stage, progress });
}

/**
 * 检查是否收到中止请求
 */
function checkAbort(): void {
  if (abortRequested) {
    abortRequested = false;
    throw new Error('Task aborted by user');
  }
}

/**
 * 初始化模型
 */
async function handleInit(taskId: string, payload: InitPayload): Promise<void> {
  currentTaskId = taskId;
  abortRequested = false;

  try {
    reportProgress(taskId, 'preparing', 0);

    // 动态导入 transformers.js
    if (!transformersModule) {
      transformersModule = await import('@huggingface/transformers');
    }

    const { env, AutoModel, AutoProcessor } = transformersModule;

    // 配置环境
    // 启用本地/浏览器缓存，模型文件缓存到浏览器后刷新页面不会重新下载
    env.allowLocalModels = true;
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.proxy = payload.device === 'wasm';
    }
    // 抑制 ONNX Runtime 非关键警告（如 shape ops 被分配到 CPU 的提示）
    if (env.backends?.onnx) {
      try {
        (env.backends.onnx as Record<string, unknown>).logSeverityLevel = 3;
      } catch {
        // 若版本不支持则忽略
      }
    }

    checkAbort();
    reportProgress(taskId, 'preparing', 50);

    // 加载模型
    // 使用 transformers.js 内置的浏览器 Cache API 缓存机制，
    // 模型文件首次下载后会被缓存，后续刷新页面直接从缓存读取
    const model = await AutoModel.from_pretrained(payload.modelId, {
      device: payload.device === 'webgpu' ? 'webgpu' : undefined,
      revision: 'main',
      progress_callback: ((info: { progress?: number }) => {
        const progress = info.progress ?? 0;
        reportProgress(taskId, 'preparing', 50 + progress * 50);
      }) as unknown as import('@huggingface/transformers').ProgressCallback,
    });

    checkAbort();

    // 加载处理器
    const processor = await AutoProcessor.from_pretrained(payload.modelId, {
      revision: 'main',
      config: {
        do_normalize: payload.modelConfig.doNormalize,
        do_pad: payload.modelConfig.doPad,
        do_rescale: payload.modelConfig.doRescale,
        do_resize: payload.modelConfig.doResize,
        image_mean: payload.modelConfig.imageMean,
        feature_extractor_type: payload.modelConfig.featureExtractorType,
        image_std: payload.modelConfig.imageStd,
        resample: payload.modelConfig.resample,
        rescale_factor: payload.modelConfig.rescaleFactor,
        size: payload.modelConfig.size,
      },
    });

    checkAbort();

    // 将模型和处理器存储在全局（Worker 是单线程的）
    (self as unknown as Record<string, unknown>).__model = model;
    (self as unknown as Record<string, unknown>).__processor = processor;
    (self as unknown as Record<string, unknown>).__modelId = payload.modelId;
    (self as unknown as Record<string, unknown>).__device = payload.device;

    post('model-loaded', taskId, { modelId: payload.modelId, device: payload.device });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    post('error', taskId, { message, stack: error instanceof Error ? error.stack : undefined });
  } finally {
    currentTaskId = null;
  }
}

/**
 * 处理图片
 */
async function handleProcess(taskId: string, payload: ProcessPayload): Promise<void> {
  currentTaskId = taskId;
  abortRequested = false;

  const stageTimings: Record<ProcessStage, number> = {
    preparing: 0,
    preprocessing: 0,
    inferencing: 0,
    postprocessing: 0,
    exporting: 0,
  };

  const startTime = performance.now();

  try {
    // 获取已加载的模型和处理器
    const model = (self as unknown as Record<string, unknown>).__model as
      | Awaited<ReturnType<typeof import('@huggingface/transformers').AutoModel.from_pretrained>>
      | undefined;
    const processor = (self as unknown as Record<string, unknown>).__processor as
      | Awaited<ReturnType<typeof import('@huggingface/transformers').AutoProcessor.from_pretrained>>
      | undefined;

    if (!model || !processor) {
      throw new Error('Model not initialized. Call init first.');
    }

    checkAbort();

    // 1. 加载图片
    reportProgress(taskId, 'preparing', 0);
    const prepStart = performance.now();

    if (!transformersModule) {
      transformersModule = await import('@huggingface/transformers');
    }
    const { RawImage } = transformersModule;

    const blob = new Blob([payload.imageBuffer]);
    const img = await RawImage.fromURL(URL.createObjectURL(blob));
    checkAbort();

    stageTimings.preparing = performance.now() - prepStart;
    reportProgress(taskId, 'preparing', 100);

    // 2. 预处理
    reportProgress(taskId, 'preprocessing', 0);
    const preStart = performance.now();

    const { pixel_values } = await processor(img);
    checkAbort();

    stageTimings.preprocessing = performance.now() - preStart;
    reportProgress(taskId, 'preprocessing', 100);

    // 3. 推理
    reportProgress(taskId, 'inferencing', 0);
    const inferStart = performance.now();

    const { output } = await model({ input: pixel_values });
    checkAbort();

    stageTimings.inferencing = performance.now() - inferStart;
    reportProgress(taskId, 'inferencing', 100);

    // 4. 后处理
    reportProgress(taskId, 'postprocessing', 0);
    const postStart = performance.now();

    const maskData = (
      await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(
        img.width,
        img.height,
      )
    ).data;
    checkAbort();

    stageTimings.postprocessing = performance.now() - postStart;
    reportProgress(taskId, 'postprocessing', 100);

    // 5. 导出
    reportProgress(taskId, 'exporting', 0);
    const exportStart = performance.now();

    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2d context from OffscreenCanvas');
    }

    // 绘制原始图片
    const originalCanvas = img.toCanvas();
    ctx.drawImage(originalCanvas, 0, 0);

    // 更新 Alpha 通道
    const pixelData = ctx.getImageData(0, 0, img.width, img.height);
    for (let i = 0; i < maskData.length; ++i) {
      pixelData.data[4 * i + 3] = maskData[i];
    }
    ctx.putImageData(pixelData, 0, 0);
    checkAbort();

    // 转换为 Blob
    const resultBlob = await canvas.convertToBlob({
      type: 'image/png',
    });

    stageTimings.exporting = performance.now() - exportStart;
    reportProgress(taskId, 'exporting', 100);

    const duration = performance.now() - startTime;
    const baseName = payload.fileName.replace(/\.[^/.]+$/, '');

    post('complete', taskId, {
      result: {
        blob: resultBlob,
        fileName: `${baseName}-bg-removed.png`,
        originalSize: { width: img.width, height: img.height },
        outputSize: { width: img.width, height: img.height },
        duration,
        stageTimings,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    post('error', taskId, { message, stack: error instanceof Error ? error.stack : undefined });
  } finally {
    currentTaskId = null;
  }
}

/**
 * 处理中止请求
 */
function handleAbort(_taskId: string, payload: AbortPayload): void {
  if (payload.taskId === currentTaskId) {
    abortRequested = true;
  }
}

/**
 * 处理终止请求
 */
function handleTerminate(): void {
  abortRequested = true;
  currentTaskId = null;
  self.close();
}

/**
 * 主消息处理器
 */
self.onmessage = (e: MessageEvent<WorkerInputMessage>) => {
  const { type, taskId, payload } = e.data;

  switch (type) {
    case 'init':
      handleInit(taskId, payload as InitPayload);
      break;
    case 'process':
      handleProcess(taskId, payload as ProcessPayload);
      break;
    case 'abort':
      handleAbort(taskId, payload as AbortPayload);
      break;
    case 'terminate':
      handleTerminate();
      break;
    default:
      post('error', taskId, { message: `Unknown task type: ${type}` });
  }
};

// 导出空对象以便 TypeScript 模块系统识别
export {};
