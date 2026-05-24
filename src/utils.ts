/**
 * browser-rmbg - Utility Functions
 */

/**
 * 创建超时 Promise
 * @param ms 超时毫秒数
 * @param message 超时消息
 */
export function createTimeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout: ${message}`)), ms);
  });
}

/**
 * 带超时的 Promise 包装器
 * @param promise 原始 Promise
 * @param ms 超时毫秒
 * @param message 超时消息
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  return Promise.race([promise, createTimeout(ms, message)]);
}

/**
 * 创建 AbortController 并关联超时
 * @param ms 超时毫秒
 */
export function createAbortController(ms?: number): {
  controller: AbortController;
  clear: () => void;
} {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (ms && ms > 0) {
    timer = setTimeout(() => controller.abort(new Error(`Operation timed out after ${ms}ms`)), ms);
  }

  return {
    controller,
    clear: () => {
      if (timer) clearTimeout(timer);
    },
  };
}

/**
 * 检查信号是否已中止
 * @param signal AbortSignal
 */
export function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error(signal.reason?.message || 'Operation aborted');
  }
}

/**
 * Blob 转 ArrayBuffer
 * @param blob Blob 对象
 */
export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * ArrayBuffer 转 Blob
 * @param buffer ArrayBuffer
 * @param type MIME 类型
 */
export function arrayBufferToBlob(
  buffer: ArrayBuffer,
  type: string
): Blob {
  return new Blob([buffer], { type });
}

/**
 * 获取文件扩展名
 * @param fileName 文件名
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * 生成输出文件名
 * @param originalName 原始文件名
 * @param suffix 后缀
 * @param ext 扩展名
 */
export function generateOutputFileName(
  originalName: string,
  suffix: string = 'bg-removed',
  ext: string = 'png'
): string {
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return `${baseName}-${suffix}.${ext}`;
}

/**
 * 延迟函数
 * @param ms 毫秒
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测量函数执行时间
 * @param fn 要测量的函数
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * 安全获取 Canvas 2D Context
 * @param canvas HTMLCanvasElement
 */
export function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to get Canvas 2D context');
  }
  return ctx;
}

/**
 * Canvas 转 Blob
 * @param canvas HTMLCanvasElement
 * @param type MIME 类型
 * @param quality 质量（0-1）
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/png',
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      type,
      quality
    );
  });
}

/**
 * 加载图片
 * @param src 图片源（URL 或 Blob URL）
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * 限制 Promise 并发数
 * @param tasks 任务数组
 * @param maxConcurrency 最大并发数
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const promise = tasks[i]().then(result => {
      results[i] = result;
    });

    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}
