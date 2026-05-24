# browser-rmbg

高性能浏览器端 AI 背景移除库，支持 WebGPU / WebGL / WASM 三级自动降级策略。

> 🌍 [English README](#english-readme) | 中文文档

---

## ✨ 特性

- 🚀 **WebGPU 优先加速** — 自动检测并使用 WebGPU 进行最快推理
- 🔄 **三级降级策略** — WebGPU → WebGL → WASM/CPU，确保在任何现代浏览器上都能正常工作
- 💾 **IndexedDB 模型缓存** — 模型文件一次下载后持久化缓存，后续无需重复下载
- ⚡ **Web Worker 并行** — 所有重型推理在 Web Worker 中运行，主线程保持流畅响应
- ⏹️ **任务中断控制** — 支持单个任务或全部任务的中止操作
- 📡 **完整事件暴露** — 实时进度、设备检测、模型加载、任务完成等全链路事件
- 📦 **标准 NPM 包** — ESM + CJS + TypeScript 声明三合一
- 🔒 **本地隐私处理** — 图片完全在浏览器本地处理，不上传至任何服务器

## 📦 安装

```bash
npm install browser-rmbg
```

## 🚀 快速开始

```typescript
import { BGRemove } from 'browser-rmbg';

const bgRemove = new BGRemove();

// 初始化（自动检测最佳设备）
const initResult = await bgRemove.initialize();
console.log(`使用设备: ${initResult.device}, 模型: ${initResult.model}`);

// 监听进度事件
bgRemove.on('task-progress', ({ taskId, stage, progress }) => {
  console.log(`任务 ${taskId}: ${stage} ${Math.round(progress * 100)}%`);
});

// 处理图片
const result = await bgRemove.process(imageFile);
console.log(`完成! 文件: ${result.fileName}, 耗时: ${result.duration}ms`);

// 下载结果
const url = URL.createObjectURL(result.blob);
const a = document.createElement('a');
a.href = url;
a.download = result.fileName;
a.click();
```

## 📖 API 参考

### 构造函数

```typescript
new BGRemove(options?: BGRemoveOptions)
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `devicePreference` | `'webgpu' \| 'webgl' \| 'wasm'` | 自动 | 偏好设备类型 |
| `modelPreference` | `'briaai/RMBG-1.4' \| 'Xenova/modnet'` | 自动 | 偏好模型 |
| `enableCache` | `boolean` | `true` | 启用 IndexedDB 模型缓存 |
| `maxWorkers` | `number` | 硬件并发数 | 最大 Web Workers |
| `modelLoadTimeout` | `number` | `120000` | 模型加载超时（毫秒） |
| `processTimeout` | `number` | `60000` | 单图处理超时（毫秒） |
| `workerScript` | `string` | 自动推断 | 自定义 Worker 脚本路径 |

### 方法

| 方法 | 说明 |
|------|------|
| `initialize(devicePreference?)` | 初始化模型与设备检测 |
| `process(image, options?)` | 处理单张图片 |
| `processBatch(images, options?)` | 批量处理（并发控制） |
| `abort(taskId?)` | 中止指定或全部任务 |
| `switchModel(modelId)` | 切换模型 |
| `switchDevice(device)` | 切换设备 |
| `clearCache()` | 清除 IndexedDB 模型缓存 |
| `detectDevices()` | 静态方法：检测设备能力 |
| `destroy()` | 清理所有资源 |

### 事件

```typescript
bgRemove.on('device-detected', ({ webgpu, webgl, wasm, recommended }) => {
  // 设备能力检测完成
});

bgRemove.on('model-loading', ({ modelId, progress }) => {
  // 模型加载进度
});

bgRemove.on('model-loaded', ({ modelId, device }) => {
  // 模型加载完成
});

bgRemove.on('model-load-error', ({ modelId, error }) => {
  // 模型加载失败
});

bgRemove.on('task-start', ({ taskId, fileName }) => {
  // 任务开始
});

bgRemove.on('task-progress', ({ taskId, stage, progress }) => {
  // 任务进度：preparing / preprocessing / inferencing / postprocessing / exporting
});

bgRemove.on('task-complete', (result) => {
  // 任务完成
});

bgRemove.on('task-error', ({ taskId, error }) => {
  // 任务失败
});

bgRemove.on('task-aborted', ({ taskId }) => {
  // 任务被中止
});

bgRemove.on('fallback', ({ from, to, reason }) => {
  // 设备降级触发
});
```

### 设备检测

```typescript
const caps = await BGRemove.detectDevices();
// {
//   webgpu: { supported: true, adapterInfo: { vendor: 'Apple' } },
//   webgl:  { supported: true, version: 2, vendor: '...', renderer: '...' },
//   wasm:   { supported: true, simd: true, threads: true },
//   recommended: 'webgpu',
//   isIOS: false,
//   isMobile: false,
//   hardwareConcurrency: 8
// }
```

### 批量处理

```typescript
const results = await bgRemove.processBatch(imageFiles, {
  format: 'png',
  parallel: true,
  maxConcurrency: 4,
  onItemComplete: (result, index) => {
    console.log(`第 ${index + 1} 张完成, 耗时 ${result.duration}ms`);
  },
  onItemError: (error, index) => {
    console.error(`第 ${index + 1} 张失败: ${error.message}`);
  }
});
```

## 🏗️ 架构

```
┌─ 用户 / React 应用 ───────────────────────────┐
│              BGRemove (主类)                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐     │
│  │ Detector│ │  Cache  │ │ WorkerPool  │     │
│  │(WebGPU→ │ │(Indexed│ │ (推理卸载)   │     │
│  │WebGL→   │ │ DB)     │ │             │     │
│  │ WASM)   │ │         │ │             │     │
│  └─────────┘ └─────────┘ └─────────────┘     │
│         ┌─────────┐  ┌─────────────┐          │
│         │ModelMgr │  │ Processor   │          │
│         │(加载/  │  │ (中止/     │          │
│         │切换)   │  │  批处理)    │          │
│         └─────────┘  └─────────────┘          │
└───────────────────────────────────────────────┘
```

## 🤖 模型

| 模型 | 推荐设备 | 速度 | 兼容性 |
|------|----------|------|--------|
| `Xenova/modnet` | WebGPU | 最快 | Chrome 113+ |
| `briaai/RMBG-1.4` | WASM / WebGL | 快 | 所有现代浏览器 |

## 🌐 浏览器支持

- **Chrome / Edge 113+**: WebGPU + MODNet（最佳性能）
- **Safari / Firefox**: WebGL + RMBG-1.4
- **iOS Safari**: WASM + RMBG-1.4（已优化）
- **降级模式**: WASM CPU 模式（保证可用）

## 📁 项目结构

```
├── src/
│   ├── index.ts          # 主入口：BGRemove 类
│   ├── types.ts          # TypeScript 类型定义
│   ├── detector.ts       # 设备检测器
│   ├── cache.ts          # IndexedDB 模型缓存
│   ├── events.ts         # 事件总线
│   ├── model.ts          # 模型管理器
│   ├── processor.ts      # 图片处理器
│   ├── utils.ts          # 工具函数
│   ├── constants.ts      # 常量定义
│   └── worker/
│       ├── worker.ts     # Web Worker 脚本
│       ├── manager.ts    # Worker 池管理
│       └── types.ts      # Worker 类型
├── demo/
│   ├── main.ts           # 演示页面逻辑
│   └── style.css         # 演示页面样式
├── tests/                # Vitest 测试套件
└── index.html            # 演示页面入口
```

## 🧪 开发

```bash
# 安装依赖
npm install

# 启动演示页面（含热更新）
npm run dev

# 运行测试
npm test

# 构建库
npm run build

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

## 📄 License

MIT License © [bg-remove](https://github.com/bg-remove/core)

---

<a name="english-readme"></a>

## English README

High-performance AI background removal in the browser with WebGPU / WebGL / WASM three-level fallback.

### Features

- 🚀 **WebGPU Priority** — Automatically detects and uses WebGPU for fastest inference
- 🔄 **Three-Level Fallback** — WebGPU → WebGL → WASM/CPU, guaranteed to work on any modern browser
- 💾 **IndexedDB Model Cache** — Persistent model file caching to avoid repeated downloads
- ⚡ **Web Worker Offload** — All heavy inference runs in Web Workers, keeping the main thread responsive
- ⏹️ **Abort / Interrupt** — Full abort support for individual tasks or all tasks at once
- 📡 **Full Event Exposure** — Real-time progress, device detection, model loading, task completion events
- 📦 **NPM Package Standard** — ESM + CJS + TypeScript declarations

### Quick Start

```bash
npm install browser-rmbg
```

```typescript
import { BGRemove } from 'browser-rmbg';

const bgRemove = new BGRemove();
const result = await bgRemove.process(imageFile);
```

### License

MIT
