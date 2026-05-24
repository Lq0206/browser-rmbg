/*
 * @Author: 667 575920678@qq.com
 * @Date: 2026-05-23 21:29:37
 * @LastEditors: 667 575920678@qq.com
 * @LastEditTime: 2026-05-23 23:18:23
 * @FilePath: /browser-rmbg/src/constants.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * browser-rmbg - Constants
 */

import type { ModelConfig, ModelId } from './types';

/** 包版本 */
export const VERSION = '1.0.0';

/** 模型标识常量 */
export const MODEL_IDS = {
  RMBG: 'briaai/RMBG-1.4' as ModelId,
  MODNET: 'Xenova/modnet' as ModelId,
};

/** 设备类型优先级（从高到低） */
export const DEVICE_PRIORITY: Array<'webgpu' | 'webgl' | 'wasm'> = [
  'webgpu',
  'webgl',
  'wasm',
];

/** 模型到推荐设备的映射 */
export const MODEL_DEVICE_MAP: Record<ModelId, 'webgpu' | 'wasm'> = {
  'briaai/RMBG-1.4': 'wasm',
  'Xenova/modnet': 'webgpu',
};

/** RMBG-1.4 默认配置 */
export const RMBG_CONFIG: ModelConfig = {
  size: { width: 1024, height: 1024 },
  doNormalize: true,
  doPad: true,
  doRescale: true,
  doResize: true,
  imageMean: [0.5, 0.5, 0.5],
  imageStd: [0.5, 0.5, 0.5],
  resample: 2,
  rescaleFactor: 0.00392156862745098,
  featureExtractorType: 'ImageFeatureExtractor',
};

/** MODNet 默认配置 */
export const MODNET_CONFIG: ModelConfig = {
  size: { width: 1024, height: 1024 },
  doNormalize: true,
  doPad: false,
  doRescale: true,
  doResize: true,
  imageMean: [0.5, 0.5, 0.5],
  imageStd: [1, 1, 1],
  resample: 2,
  rescaleFactor: 0.00392156862745098,
  featureExtractorType: 'ImageFeatureExtractor',
};

/** 模型配置映射 */
export const MODEL_CONFIGS: Record<ModelId, ModelConfig> = {
  'briaai/RMBG-1.4': RMBG_CONFIG,
  'Xenova/modnet': MODNET_CONFIG,
};

/** 默认超时（毫秒） */
export const DEFAULT_TIMEOUTS = {
  modelLoad: 120000,
  process: 60000,
  init: 30000,
};

/** 默认 Worker 数量 */
export const DEFAULT_MAX_WORKERS =
  typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

/** 缓存数据库配置 */
export const CACHE_CONFIG = {
  dbName: 'BGRemoveCache',
  dbVersion: 2,
  storeName: 'models',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 天
};

/** 生成唯一任务 ID */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 生成版本标识（用于缓存失效） */
export function generateCacheVersion(modelId: string): string {
  return `${modelId}_v${VERSION}`;
}
