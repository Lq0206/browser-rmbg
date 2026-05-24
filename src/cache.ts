/**
 * browser-rmbg - IndexedDB Model Cache
 * Persistent caching for model files using Dexie.js
 */

import Dexie from 'dexie';
import { CACHE_CONFIG } from './constants';

interface ModelCacheTable {
  modelId: string;
  version: string;
  size: number;
  timestamp: number;
  data: ArrayBuffer;
}

class CacheDatabase extends Dexie {
  models!: Dexie.Table<ModelCacheTable, string>;

  constructor() {
    super(CACHE_CONFIG.dbName);
    this.version(CACHE_CONFIG.dbVersion).stores({
      models: 'modelId',
    });
  }
}

export class ModelCache {
  private db: CacheDatabase;
  private memoryCache: Map<string, ArrayBuffer> = new Map();
  private _ready: Promise<void>;

  constructor() {
    this.db = new CacheDatabase();
    this._ready = this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.db.open();
    } catch (error) {
      console.warn('[ModelCache] Failed to open IndexedDB:', error);
    }
  }

  /** 等待缓存初始化完成 */
  async ready(): Promise<void> {
    return this._ready;
  }

  /**
   * 检查缓存中是否存在指定模型
   */
  async has(modelId: string, version?: string): Promise<boolean> {
    await this._ready;

    // 先检查内存缓存
    if (this.memoryCache.has(modelId)) {
      return true;
    }

    try {
      const entry = await this.db.models.get(modelId);
      if (!entry) return false;

      // 检查版本是否匹配
      if (version && entry.version !== version) {
        return false;
      }

      // 检查是否过期
      if (Date.now() - entry.timestamp > CACHE_CONFIG.maxAge) {
        await this.remove(modelId);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从缓存获取模型数据
   */
  async get(modelId: string, version?: string): Promise<ArrayBuffer | null> {
    await this._ready;

    // 先检查内存缓存
    const memCache = this.memoryCache.get(modelId);
    if (memCache) {
      return memCache.slice(0); // 返回副本
    }

    try {
      const entry = await this.db.models.get(modelId);
      if (!entry) return null;

      // 版本检查
      if (version && entry.version !== version) {
        await this.remove(modelId);
        return null;
      }

      // 过期检查
      if (Date.now() - entry.timestamp > CACHE_CONFIG.maxAge) {
        await this.remove(modelId);
        return null;
      }

      // 存入内存缓存
      this.memoryCache.set(modelId, entry.data);

      return entry.data.slice(0); // 返回副本
    } catch (error) {
      console.warn('[ModelCache] Failed to get from cache:', error);
      return null;
    }
  }

  /**
   * 将模型数据存入缓存
   */
  async set(
    modelId: string,
    data: ArrayBuffer,
    version?: string
  ): Promise<void> {
    await this._ready;

    const entry: ModelCacheTable = {
      modelId,
      version: version || 'latest',
      size: data.byteLength,
      timestamp: Date.now(),
      data,
    };

    try {
      await this.db.models.put(entry);
      this.memoryCache.set(modelId, data);
    } catch (error) {
      console.warn('[ModelCache] Failed to save to cache:', error);
    }
  }

  /**
   * 从缓存中移除指定模型
   */
  async remove(modelId: string): Promise<void> {
    await this._ready;

    try {
      await this.db.models.delete(modelId);
      this.memoryCache.delete(modelId);
    } catch (error) {
      console.warn('[ModelCache] Failed to remove from cache:', error);
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    await this._ready;

    try {
      await this.db.models.clear();
      this.memoryCache.clear();
    } catch (error) {
      console.warn('[ModelCache] Failed to clear cache:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{
    count: number;
    totalSize: number;
    entries: Array<{ modelId: string; version: string; size: number; age: number }>;
  }> {
    await this._ready;

    try {
      const entries = await this.db.models.toArray();
      const now = Date.now();

      return {
        count: entries.length,
        totalSize: entries.reduce((sum, e) => sum + e.size, 0),
        entries: entries.map(e => ({
          modelId: e.modelId,
          version: e.version,
          size: e.size,
          age: now - e.timestamp,
        })),
      };
    } catch {
      return { count: 0, totalSize: 0, entries: [] };
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<number> {
    await this._ready;

    try {
      const entries = await this.db.models.toArray();
      const now = Date.now();
      const expired = entries.filter(
        e => now - e.timestamp > CACHE_CONFIG.maxAge
      );

      for (const entry of expired) {
        await this.db.models.delete(entry.modelId);
        this.memoryCache.delete(entry.modelId);
      }

      return expired.length;
    } catch {
      return 0;
    }
  }

  /**
   * 销毁缓存实例
   */
  destroy(): void {
    this.memoryCache.clear();
    try {
      this.db.close();
    } catch {
      // ignore
    }
  }
}
