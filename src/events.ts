/**
 * browser-rmbg - Event Bus
 * Typed event system for internal communication and external exposure.
 */

import type { BGRemoveEventMap, BGRemoveEventName } from './types';

type EventHandler<T> = (payload: T) => void;

export class EventBus {
  private listeners: Map<string, Set<EventHandler<unknown>>> = new Map();

  /** 注册事件监听器 */
  on<K extends BGRemoveEventName>(
    event: K,
    handler: EventHandler<BGRemoveEventMap[K]>
  ): () => void {
    const key = event as string;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(handler as EventHandler<unknown>);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  /** 移除事件监听器 */
  off<K extends BGRemoveEventName>(
    event: K,
    handler: EventHandler<BGRemoveEventMap[K]>
  ): void {
    const key = event as string;
    const set = this.listeners.get(key);
    if (set) {
      set.delete(handler as EventHandler<unknown>);
      if (set.size === 0) {
        this.listeners.delete(key);
      }
    }
  }

  /** 触发事件 */
  emit<K extends BGRemoveEventName>(
    event: K,
    payload: BGRemoveEventMap[K]
  ): void {
    const key = event as string;
    const set = this.listeners.get(key);
    if (set) {
      set.forEach(handler => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${key}":`, err);
        }
      });
    }
  }

  /** 一次性监听 */
  once<K extends BGRemoveEventName>(
    event: K,
    handler: EventHandler<BGRemoveEventMap[K]>
  ): () => void {
    const onceHandler = (payload: BGRemoveEventMap[K]) => {
      this.off(event, onceHandler as EventHandler<BGRemoveEventMap[K]>);
      handler(payload);
    };
    return this.on(event, onceHandler as EventHandler<BGRemoveEventMap[K]>);
  }

  /** 等待某个事件 */
  waitFor<K extends BGRemoveEventName>(
    event: K,
    timeoutMs?: number
  ): Promise<BGRemoveEventMap[K]> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const unsub = this.once(event, (payload) => {
        if (timer) clearTimeout(timer);
        resolve(payload);
      });

      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => {
          unsub();
          reject(new Error(`Timeout waiting for event "${event}"`));
        }, timeoutMs);
      }
    });
  }

  /** 清除所有监听器 */
  clear(): void {
    this.listeners.clear();
  }

  /** 获取当前监听器数量 */
  listenerCount(event?: BGRemoveEventName): number {
    if (event) {
      const set = this.listeners.get(event as string);
      return set ? set.size : 0;
    }
    let total = 0;
    for (const set of this.listeners.values()) {
      total += set.size;
    }
    return total;
  }
}
