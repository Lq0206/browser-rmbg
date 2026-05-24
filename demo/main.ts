/**
 * browser-rmbg - Demo Page
 * 功能展示 + 交互式演示 + API 文档
 */

import { BGRemove, DeviceDetector } from '../src/index';
import type { ProcessResult } from '../src/index';
import JSZip from 'jszip';
import { icons } from 'lucide';

// Vite 环境下使用专门的 Worker import 语法
// @ts-ignore - Vite 特定的 import 语法
import WorkerScript from '../src/worker/worker.ts?worker&url';

// ───────────────────────────── 工具函数 ─────────────────────────────

/** 格式化耗时：毫秒级显示整数，秒级保留一位小数 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** kebab-case → PascalCase */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** 生成 Lucide SVG 字符串 */
function lucideSvg(name: string, size = 24, strokeWidth = 1.5, className = ''): string {
  const iconData = (icons as Record<string, [string, Record<string, string>][]>)[toPascalCase(name)];
  if (!iconData) return '';
  const children = iconData.map(([tag, attrs]) => {
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v.replace(/"/g, '"')}"`)
      .join(' ');
    return `<${tag} ${attrStr} />`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${className}">${children}</svg>`;
}

/** 创建灰白格子背景容器 */
function createCheckerboardHTML(imgUrl: string, alt: string, className = ''): string {
  return `<div class="gallery-img-wrap checkerboard ${className}"><img src="${imgUrl}" alt="${alt}" /></div>`;
}

// ───────────────────────────── 模板渲染 ─────────────────────────────

function renderPage() {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <nav class="navbar">
      <div class="container">
        <a href="#" class="nav-brand">${lucideSvg('target', 22, 2)}browser-rmbg</a>
        <ul class="nav-links">
          <li><a href="#features">特性</a></li>
          <li><a href="#demo">在线演示</a></li>
          <li><a href="#docs">API 文档</a></li>
          <li><a href="https://github.com/bg-remove/core" target="_blank" class="nav-github">
            ${lucideSvg('github', 16, 2, 'nav-github-icon')}
            GitHub
          </a></li>
        </ul>
      </div>
    </nav>

    <header class="hero">
      <div class="container">
        <div class="hero-badge">${lucideSvg('sparkles', 16, 2)} 纯浏览器端 · 零服务器 · 隐私安全</div>
        <h1>高性能 AI 背景移除<br><span>WebGPU / WebGL / WASM</span></h1>
        <p class="hero-subtitle">
          在浏览器中直接使用 AI 模型移除图片背景，支持 WebGPU 优先的三级降级策略，
          IndexedDB 模型缓存，Web Worker 并行处理，全程不上传任何数据。
        </p>
        <div class="hero-actions">
          <a href="#demo" class="btn btn-primary">${lucideSvg('rocket', 18, 2)} 立即体验</a>
          <a href="#docs" class="btn btn-secondary">${lucideSvg('book-open', 18, 2)} 查看文档</a>
        </div>
        <div class="install-bar">
          <div class="install-box">
            <code>npm install browser-rmbg</code>
            <button id="copy-install" title="复制">${lucideSvg('copy', 16, 2)}</button>
          </div>
        </div>
      </div>
    </header>

    <section id="features" class="section">
      <div class="container">
        <h2 class="section-title">核心特性</h2>
        <p class="section-desc">专为浏览器环境设计的高性能背景移除解决方案</p>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon" data-icon="zap">${lucideSvg('zap', 24, 2)}</div>
            <h3>WebGPU 优先加速</h3>
            <p>自动检测并使用 WebGPU 进行最快推理，GPU 加速让处理速度提升数倍。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-icon="layers">${lucideSvg('layers', 24, 2)}</div>
            <h3>三级降级策略</h3>
            <p>WebGPU → WebGL → WASM/CPU 自动降级，确保在任何现代浏览器上都能正常工作。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-icon="database">${lucideSvg('database', 24, 2)}</div>
            <h3>IndexedDB 模型缓存</h3>
            <p>模型文件一次下载后持久化缓存，后续使用无需重复下载。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-icon="cpu">${lucideSvg('cpu', 24, 2)}</div>
            <h3>Web Worker 并行</h3>
            <p>所有重型推理在 Web Worker 中运行，主线程保持流畅响应。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-icon="ban">${lucideSvg('ban', 24, 2)}</div>
            <h3>任务中断控制</h3>
            <p>支持单个任务或全部任务的中止操作，灵活控制处理流程。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-icon="activity">${lucideSvg('activity', 24, 2)}</div>
            <h3>完整事件暴露</h3>
            <p>实时进度、设备检测、模型加载、任务完成等全链路事件。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-icon="package">${lucideSvg('package', 24, 2)}</div>
            <h3>标准 NPM 包</h3>
            <p>ESM + CJS + TypeScript 声明三合一，与现代构建工具无缝集成。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-icon="shield-check">${lucideSvg('shield-check', 24, 2)}</div>
            <h3>本地隐私处理</h3>
            <p>图片完全在本地浏览器处理，不上传至任何服务器。</p>
          </div>
        </div>
      </div>
    </section>

    <section id="demo" class="section" style="background:#fff;">
      <div class="container">
        <h2 class="section-title">在线演示</h2>
        <p class="section-desc">上传图片即可体验浏览器端 AI 背景移除</p>
        <div class="demo-area">
          <div class="device-info" id="device-info"><span class="device-chip">${lucideSvg('search', 14, 2)} 检测中...</span></div>
          <div class="status-bar" id="status-bar" style="display:none;">
            <span class="spinner"></span>
            <span id="status-text">准备中...</span>
          </div>
          <div class="first-hint" id="first-hint" style="display:none;">
            <span class="emoji">${lucideSvg('sprout', 20, 2)}</span>
            <span>首次使用需要多花费一点时间加载 AI 模型，请耐心等待，之后就会快很多啦～</span>
          </div>
          <div class="dropzone" id="dropzone">
            <input type="file" id="file-input" accept="image/*" multiple />
            <div class="icon">${lucideSvg('upload-cloud', 48, 1.5)}</div>
            <h4>拖拽图片到此处，或点击选择文件</h4>
            <p>支持 JPG、PNG、WebP，支持批量上传</p>
          </div>
          <div class="gallery-toolbar" id="gallery-toolbar" style="display:none;">
            <div class="gallery-count" id="gallery-count"></div>
            <button class="btn btn-sm btn-secondary" id="btn-batch-download">
              ${lucideSvg('archive', 16, 2)} 批量下载 (ZIP)
            </button>
          </div>
          <div class="gallery" id="gallery"></div>
        </div>
      </div>
    </section>

    <section id="docs" class="section">
      <div class="container">
        <h2 class="section-title">API 文档</h2>
        <p class="section-desc">快速上手，深入了解 browser-rmbg 的完整 API</p>
        <div class="docs-grid">
          <aside class="docs-sidebar">
            <h4>目录</h4>
            <ul>
              <li><a href="#doc-quickstart" class="doc-nav-link active">快速开始</a></li>
              <li><a href="#doc-events" class="doc-nav-link">事件系统</a></li>
              <li><a href="#doc-options" class="doc-nav-link">配置选项</a></li>
              <li><a href="#doc-methods" class="doc-nav-link">方法列表</a></li>
              <li><a href="#doc-device" class="doc-nav-link">设备检测</a></li>
              <li><a href="#doc-batch" class="doc-nav-link">批量处理</a></li>
              <li><a href="#doc-flow" class="doc-nav-link">处理流程</a></li>
            </ul>
          </aside>
          <div class="doc-content">
            <h3 id="doc-quickstart">快速开始</h3>
            <p>只需几行代码即可在项目中使用背景移除功能：</p>
            <pre><code>import { BGRemove } from 'browser-rmbg';

const bgRemove = new BGRemove();
const initResult = await bgRemove.initialize();

bgRemove.on('task-progress', ({ taskId, stage, progress }) => {
  console.log(\`任务 \${taskId}: \${stage} \${Math.round(progress * 100)}%\`);
});

const result = await bgRemove.process(imageFile);
console.log(\`完成! 文件: \${result.fileName}, 耗时: \${result.duration}ms\`);</code></pre>

            <h3 id="doc-events">事件系统</h3>
            <pre><code>bgRemove.on('device-detected', ({ webgpu, webgl, wasm, recommended }) => {});
bgRemove.on('model-loading', ({ modelId, progress }) => {});
bgRemove.on('model-loaded', ({ modelId, device }) => {});
bgRemove.on('task-progress', ({ taskId, stage, progress }) => {});
bgRemove.on('task-complete', (result) => {});
bgRemove.on('task-error', ({ taskId, error }) => {});
bgRemove.on('task-aborted', ({ taskId }) => {});
bgRemove.on('fallback', ({ from, to, reason }) => {});</code></pre>

            <h3 id="doc-options">配置选项</h3>
            <table>
              <thead><tr><th>选项</th><th>类型</th><th>默认值</th><th>说明</th></tr></thead>
              <tbody>
                <tr><td><code>devicePreference</code></td><td><code>'webgpu'|'webgl'|'wasm'</code></td><td>自动</td><td>偏好设备类型</td></tr>
                <tr><td><code>modelPreference</code></td><td><code>ModelId</code></td><td>自动</td><td>偏好模型</td></tr>
                <tr><td><code>enableCache</code></td><td><code>boolean</code></td><td><code>true</code></td><td>启用 IndexedDB 缓存</td></tr>
                <tr><td><code>maxWorkers</code></td><td><code>number</code></td><td>硬件并发数</td><td>最大 Web Workers</td></tr>
                <tr><td><code>modelLoadTimeout</code></td><td><code>number</code></td><td><code>120000</code></td><td>模型加载超时(ms)</td></tr>
                <tr><td><code>processTimeout</code></td><td><code>number</code></td><td><code>60000</code></td><td>单图处理超时(ms)</td></tr>
              </tbody>
            </table>

            <h3 id="doc-methods">方法列表</h3>
            <table>
              <thead><tr><th>方法</th><th>说明</th></tr></thead>
              <tbody>
                <tr><td><code>initialize(devicePreference?)</code></td><td>初始化模型与设备检测</td></tr>
                <tr><td><code>process(image, options?)</code></td><td>处理单张图片</td></tr>
                <tr><td><code>processBatch(images, options?)</code></td><td>批量处理（并发控制）</td></tr>
                <tr><td><code>abort(taskId?)</code></td><td>中止指定或全部任务</td></tr>
                <tr><td><code>switchModel(modelId)</code></td><td>切换模型</td></tr>
                <tr><td><code>switchDevice(device)</code></td><td>切换设备</td></tr>
                <tr><td><code>clearCache()</code></td><td>清除 IndexedDB 缓存</td></tr>
                <tr><td><code>detectDevices()</code></td><td>静态方法：检测设备能力</td></tr>
                <tr><td><code>destroy()</code></td><td>清理所有资源</td></tr>
              </tbody>
            </table>

            <h3 id="doc-device">设备检测</h3>
            <pre><code>const caps = await BGRemove.detectDevices();
// { webgpu, webgl, wasm, recommended, isIOS, isMobile, hardwareConcurrency }</code></pre>

            <h3 id="doc-batch">批量处理</h3>
            <pre><code>const results = await bgRemove.processBatch(imageFiles, {
  format: 'png', parallel: true, maxConcurrency: 4,
  onItemComplete: (result, index) => {},
  onItemError: (error, index) => {}
});</code></pre>

            <h3 id="doc-flow">处理流程</h3>
            <div class="event-flow">
              <span class="event-node">${lucideSvg('file-text', 14, 2)} 读取文件</span><span class="event-arrow">→</span>
              <span class="event-node">${lucideSvg('wand-2', 14, 2)} 预处理</span><span class="event-arrow">→</span>
              <span class="event-node">${lucideSvg('brain', 14, 2)} AI 推理</span><span class="event-arrow">→</span>
              <span class="event-node">${lucideSvg('scissors', 14, 2)} 后处理</span><span class="event-arrow">→</span>
              <span class="event-node">${lucideSvg('image', 14, 2)} 导出图片</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="container">
        <p>browser-rmbg — MIT License · <a href="https://github.com/bg-remove/core" target="_blank">GitHub</a></p>
      </div>
    </footer>

    <!-- 图片对比 Dialog -->
    <dialog class="compare-dialog" id="compare-dialog">
      <div class="compare-dialog-header">
        <span>处理前后对比</span>
        <button id="compare-close" aria-label="关闭">${lucideSvg('x', 18, 2.5)}</button>
      </div>
      <div class="compare-dialog-body">
        <div class="compare-container" id="compare-container">
          <div class="compare-base" id="compare-base"></div>
          <div class="compare-overlay" id="compare-overlay"></div>
          <div class="compare-handle" id="compare-handle">
            <div class="compare-handle-inner">
              ${lucideSvg('chevron-left', 16, 2.5)}
            </div>
          </div>
          <div class="compare-label compare-label-left">${lucideSvg('target', 12, 2)} 处理后（已去背景）</div>
          <div class="compare-label compare-label-right">${lucideSvg('image', 12, 2)} 原图</div>
        </div>
      </div>
    </dialog>
  `;
}

// ───────────────────────────── 设备检测 UI ─────────────────────────────

async function renderDeviceInfo() {
  const container = document.getElementById('device-info')!;
  try {
    const caps = await DeviceDetector.detect();
    const chips: string[] = [];
    chips.push(`${lucideSvg('monitor', 14, 2)} ${caps.hardwareConcurrency} 核心`);
    chips.push(caps.isMobile ? `${lucideSvg('smartphone', 14, 2)} 移动设备` : `${lucideSvg('laptop', 14, 2)} 桌面设备`);
    if (caps.webgpu.supported) {
      const vendor = caps.webgpu.adapterInfo?.vendor || 'Unknown';
      chips.push(`<span class="ok">${lucideSvg('zap', 14, 2)} WebGPU (${vendor})</span>`);
    } else {
      chips.push(`<span class="warn">${lucideSvg('x-circle', 14, 2)} WebGPU: ${caps.webgpu.reason || '不支持'}</span>`);
    }
    if (caps.webgl.supported) {
      chips.push(`<span class="ok">${lucideSvg('palette', 14, 2)} WebGL ${caps.webgl.version}</span>`);
    } else {
      chips.push(`<span class="warn">${lucideSvg('x-circle', 14, 2)} WebGL: ${caps.webgl.reason || '不支持'}</span>`);
    }
    if (caps.wasm.supported) {
      const feats = [caps.wasm.simd && 'SIMD', caps.wasm.threads && 'Threads'].filter(Boolean).join(', ');
      chips.push(`<span class="ok">${lucideSvg('wrench', 14, 2)} WASM${feats ? ` (${feats})` : ''}</span>`);
    } else {
      chips.push(`<span class="warn">${lucideSvg('x-circle', 14, 2)} WASM</span>`);
    }
    chips.push(`${lucideSvg('pin', 14, 2)} 推荐: ${caps.recommended.toUpperCase()}`);
    container.innerHTML = chips.map(c => `<span class="device-chip">${c}</span>`).join('');
  } catch {
    container.innerHTML = `<span class="device-chip warn">${lucideSvg('alert-triangle', 14, 2)} 设备检测失败</span>`;
  }
}

// ───────────────────────────── 状态管理 ─────────────────────────────

let bgRemoveInstance: BGRemove | null = null;
let initialized = false;
let hasShownFirstHint = false;

function setStatus(text: string, loading = true) {
  const bar = document.getElementById('status-bar')!;
  const txt = document.getElementById('status-text')!;
  txt.textContent = text;
  bar.style.display = loading ? 'flex' : 'none';
}

function showFirstHint() {
  if (hasShownFirstHint) return;
  hasShownFirstHint = true;
  const hint = document.getElementById('first-hint');
  if (hint) hint.style.display = 'flex';
}

function hideFirstHint() {
  const hint = document.getElementById('first-hint');
  if (hint) hint.style.display = 'none';
}

async function ensureInitialized(): Promise<BGRemove> {
  if (bgRemoveInstance && initialized) return bgRemoveInstance;

  bgRemoveInstance = new BGRemove({
    enableCache: true,
    maxWorkers: 2,
    workerScript: WorkerScript,
  });

  bgRemoveInstance.on('model-loading', ({ modelId, progress }) => {
    if (progress < 0.1 && !hasShownFirstHint) showFirstHint();
    setStatus(`加载模型 ${modelId.split('/')[1]}… ${Math.round(progress * 100)}%`, true);
  });

  bgRemoveInstance.on('model-loaded', () => {
    hideFirstHint();
    setStatus('模型就绪', false);
  });

  bgRemoveInstance.on('model-load-error', ({ error }) => {
    hideFirstHint();
    setStatus(`模型加载失败: ${error.message}`, false);
  });

  bgRemoveInstance.on('task-start', ({ fileName }) => {
    setStatus(`开始处理: ${fileName}`, true);
  });

  bgRemoveInstance.on('task-progress', ({ stage, progress }) => {
    const stageMap: Record<string, string> = {
      preparing: '准备中', preprocessing: '预处理', inferencing: 'AI 推理',
      postprocessing: '后处理', exporting: '导出中',
    };
    setStatus(`${stageMap[stage] || stage}… ${Math.round(progress * 100)}%`, true);
  });

  bgRemoveInstance.on('task-complete', () => {
    setStatus('处理完成', false);
  });

  bgRemoveInstance.on('task-error', ({ error }) => {
    setStatus(`处理失败: ${error.message}`, false);
  });

  bgRemoveInstance.on('task-aborted', ({ taskId }) => {
    setStatus(`任务已中断 (${taskId.slice(0, 6)}…)`, false);
  });

  bgRemoveInstance.on('fallback', ({ from, to, reason }) => {
    setStatus(`设备降级: ${from} → ${to} (${reason})`, true);
  });

  setStatus('正在检测设备…', true);
  await bgRemoveInstance.initialize();
  initialized = true;
  return bgRemoveInstance;
}

// ───────────────────────────── 图片处理 ─────────────────────────────

const galleryData: {
  id: string;
  original: string;
  originalFile: File;
  result?: ProcessResult;
  processing: boolean;
  taskId: string | null;
  progress: number;
  stage: string;
  aborted?: boolean;
}[] = [];

function updateGalleryToolbar() {
  const toolbar = document.getElementById('gallery-toolbar');
  const count = document.getElementById('gallery-count');
  if (!toolbar || !count) return;

  const total = galleryData.length;
  const completed = galleryData.filter(g => g.result).length;
  const processing = galleryData.filter(g => g.processing).length;

  if (total === 0) {
    toolbar.style.display = 'none';
    return;
  }

  toolbar.style.display = 'flex';
  let text = `共 ${total} 张`;
  if (processing > 0) text += `，处理中 ${processing} 张`;
  if (completed > 0) text += `，已完成 ${completed} 张`;
  count.textContent = text;
}

function renderGallery() {
  const el = document.getElementById('gallery')!;
  if (galleryData.length === 0) {
    el.innerHTML = '';
    updateGalleryToolbar();
    return;
  }

  el.innerHTML = galleryData.map((item, idx) => {
    if (item.processing) {
      return `
        <div class="gallery-item" data-idx="${idx}">
          <div class="processing-placeholder">
            <div class="processing-ring">
              <svg class="progress-ring" viewBox="0 0 36 36">
                <path class="progress-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path class="progress-ring-fill" stroke-dasharray="${Math.max(0, Math.min(100, Math.round(item.progress * 100)))}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div class="processing-percent">${Math.round(item.progress * 100)}%</div>
            </div>
            <p class="processing-stage">${item.stage || '准备中'}</p>
            <button class="btn-abort" data-abort="${item.id}">
              ${lucideSvg('square', 12, 2.5)} 中断处理
            </button>
          </div>
          <div class="meta"><span title="${item.originalFile.name}">${truncateName(item.originalFile.name)}</span><span></span></div>
        </div>
      `;
    }
    const resultUrl = item.result ? URL.createObjectURL(item.result.blob) : '';
    return `
      <div class="gallery-item" data-idx="${idx}">
        ${item.result
          ? `<div class="gallery-img-wrap checkerboard"><img src="${resultUrl}" alt="处理后" /><button class="btn-delete" data-delete="${item.id}">${lucideSvg('trash-2', 14, 2)}</button></div>`
          : `<div class="gallery-img-wrap"><img src="${item.original}" alt="原图" /></div>`}
        <div class="meta">
          <span title="${item.originalFile.name}">${truncateName(item.originalFile.name)}</span>
          <span>${item.result ? `${lucideSvg('clock', 12, 2)} ${formatDuration(item.result.duration)} · ${item.result.device.toUpperCase()}` : ''}</span>
        </div>
        ${item.result
          ? `<a href="${resultUrl}" download="${item.result.fileName}" class="btn-download">${lucideSvg('download', 14, 2)} 下载</a>`
          : ''}
      </div>
    `;
  }).join('');

  updateGalleryToolbar();

  // 绑定打断事件
  el.querySelectorAll<HTMLElement>('.btn-abort').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const galleryId = btn.dataset.abort;
      if (galleryId) abortItem(galleryId);
    });
  });

  // 绑定点击事件（对比弹窗）
  el.querySelectorAll<HTMLElement>('.gallery-item[data-idx]').forEach(card => {
    const idx = Number(card.dataset.idx);
    const item = galleryData[idx];
    if (!item?.result) return;
    card.addEventListener('click', () => openCompareDialog(item));
  });

  // 阻止下载按钮事件冒泡
  el.querySelectorAll<HTMLElement>('.btn-download').forEach(btn => {
    btn.addEventListener('click', (e) => e.stopPropagation());
  });

  // 绑定删除事件
  el.querySelectorAll<HTMLElement>('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const galleryId = btn.dataset.delete;
      if (galleryId) deleteItem(galleryId);
    });
  });
}

function abortItem(galleryId: string) {
  const item = galleryData.find(g => g.id === galleryId);
  if (!item || !item.processing) return;

  if (item.taskId && bgRemoveInstance) {
    bgRemoveInstance.abort(item.taskId);
  }
  item.processing = false;
  item.aborted = true;
  renderGallery();
}

function deleteItem(galleryId: string) {
  const idx = galleryData.findIndex(g => g.id === galleryId);
  if (idx === -1) return;
  const item = galleryData[idx];

  // 释放原图 blob URL
  URL.revokeObjectURL(item.original);

  // 如果正在处理，先中断任务
  if (item.processing && item.taskId && bgRemoveInstance) {
    bgRemoveInstance.abort(item.taskId);
  }

  galleryData.splice(idx, 1);
  renderGallery();
}

function truncateName(name: string, max = 18): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 3) + '…';
}

async function processFile(file: File) {
  const id = Math.random().toString(36).slice(2);
  const originalUrl = URL.createObjectURL(file);

  galleryData.push({ id, original: originalUrl, originalFile: file, processing: true, taskId: null, progress: 0, stage: '准备中' });
  renderGallery();

  let unsubStart: (() => void) | undefined;
  let unsubProgress: (() => void) | undefined;

  try {
    const instance = await ensureInitialized();

    let currentTaskId: string | null = null;

    unsubStart = instance.on('task-start', ({ taskId, fileName }) => {
      if (fileName === file.name) {
        currentTaskId = taskId;
        const item = galleryData.find(g => g.id === id);
        if (item) item.taskId = taskId;
      }
    });

    unsubProgress = instance.on('task-progress', ({ taskId, stage, progress }) => {
      if (taskId !== currentTaskId) return;
      const stageMap: Record<string, string> = {
        preparing: '准备中', preprocessing: '预处理', inferencing: 'AI 推理',
        postprocessing: '后处理', exporting: '导出中',
      };
      const currentStage = stageMap[stage] || stage;
      const item = galleryData.find(g => g.id === id);
      if (item && item.processing) {
        item.progress = progress;
        item.stage = currentStage;
        // 局部更新，避免全量重渲染闪烁
        const card = document.querySelector(`.gallery-item[data-idx="${galleryData.indexOf(item)}"] .processing-ring`);
        if (card) {
          const fill = card.querySelector('.progress-ring-fill') as SVGPathElement | null;
          const pct = card.querySelector('.processing-percent') as HTMLDivElement | null;
          const stg = card.parentElement?.querySelector('.processing-stage') as HTMLParagraphElement | null;
          if (fill) fill.setAttribute('stroke-dasharray', `${Math.max(0, Math.min(100, Math.round(progress * 100)))}, 100`);
          if (pct) pct.textContent = `${Math.round(progress * 100)}%`;
          if (stg) stg.textContent = currentStage;
        }
      }
    });

    const result = await instance.process(file, { format: 'png' });
    const item = galleryData.find(g => g.id === id);
    if (item && !item.aborted) {
      item.result = result;
      item.processing = false;
      item.taskId = result.taskId;
      renderGallery();
    }
  } catch (err) {
    const item = galleryData.find(g => g.id === id);
    if (item && !item.aborted) {
      item.processing = false;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('aborted') && !msg.includes('中断')) {
        setStatus(`处理失败: ${msg}`, false);
      }
      renderGallery();
    }
  } finally {
    unsubStart?.();
    unsubProgress?.();
  }
}

// ───────────────────────────── 批量下载 ─────────────────────────────

async function downloadBatch() {
  const completed = galleryData.filter(g => g.result);
  if (completed.length === 0) {
    setStatus('没有可下载的已完成图片', false);
    return;
  }

  setStatus('正在打包 ZIP…', true);
  try {
    const zip = new JSZip();
    const folder = zip.folder('bg-removed');
    if (!folder) throw new Error('创建 ZIP 文件夹失败');

    for (const item of completed) {
      if (item.result) {
        folder.file(item.result.fileName, item.result.blob);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bg-removed-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`已打包 ${completed.length} 张图片`, false);
  } catch (err) {
    setStatus(`打包失败: ${err instanceof Error ? err.message : String(err)}`, false);
  }
}

// ───────────────────────────── 图片对比 Dialog ─────────────────────────────

function openCompareDialog(item: typeof galleryData[0]) {
  if (!item.result) return;
  const dialog = document.getElementById('compare-dialog') as HTMLDialogElement;
  const base = document.getElementById('compare-base')!;
  const overlay = document.getElementById('compare-overlay')!;
  const container = document.getElementById('compare-container')!;

  const resultUrl = URL.createObjectURL(item.result.blob);

  base.innerHTML = `<img src="${resultUrl}" alt="处理后" />`;
  overlay.innerHTML = `<img src="${item.original}" alt="原图" />`;

  // 同步对比图片尺寸，确保左右两边显示大小一致
  const baseImg = base.querySelector('img') as HTMLImageElement;
  const overlayImg = overlay.querySelector('img') as HTMLImageElement;
  function syncOverlaySize() {
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (w && h) {
      overlayImg.style.width = `${w}px`;
      overlayImg.style.height = `${h}px`;
    }
  }
  let loadedCount = 0;
  function trySync() {
    loadedCount++;
    if (loadedCount >= 2) syncOverlaySize();
  }
  baseImg.onload = trySync;
  overlayImg.onload = trySync;
  if (baseImg.complete) trySync();
  if (overlayImg.complete) trySync();

  // 重置滑块位置到中间
  let ratio = 0.5;
  updateCompareRatio(ratio);

  dialog.showModal();

  // 拖拽交互
  let dragging = false;

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    updateCompareRatio(ratio);
  }

  function onPointerUp() {
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  container.addEventListener('pointerdown', (e) => {
    dragging = true;
    const rect = container.getBoundingClientRect();
    ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    updateCompareRatio(ratio);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  dialog.addEventListener('close', () => {
    URL.revokeObjectURL(resultUrl);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, { once: true });
}

function updateCompareRatio(ratio: number) {
  const overlay = document.getElementById('compare-overlay')!;
  const handle = document.getElementById('compare-handle')!;
  overlay.style.width = `${ratio * 100}%`;
  handle.style.left = `${ratio * 100}%`;
}

// ───────────────────────────── 拖拽 & 粘贴 ─────────────────────────────

function bindDropzone() {
  const dropzone = document.getElementById('dropzone')!;
  const input = document.getElementById('file-input') as HTMLInputElement;

  dropzone.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    Array.from(input.files || []).forEach(processFile);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
    files.forEach(processFile);
  });

  document.addEventListener('paste', (e) => {
    const files = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length) files.forEach(processFile);
  });
}

// ───────────────────────────── 复制安装命令 ─────────────────────────────

function bindCopyInstall() {
  const btn = document.getElementById('copy-install')!;
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText('npm install browser-rmbg');
    btn.innerHTML = lucideSvg('check', 16, 2);
    setTimeout(() => (btn.innerHTML = lucideSvg('copy', 16, 2)), 1500);
  });
}

// ───────────────────────────── 批量下载绑定 ─────────────────────────────

function bindBatchDownload() {
  const btn = document.getElementById('btn-batch-download');
  if (!btn) return;
  btn.addEventListener('click', downloadBatch);
}

// ───────────────────────────── 文档导航高亮 ─────────────────────────────

function bindDocNav() {
  const links = document.querySelectorAll<HTMLAnchorElement>('.doc-nav-link');
  const sections = document.querySelectorAll<HTMLElement>('.doc-content [id]');

  const observer = new IntersectionObserver(
    entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(l => l.classList.remove('active'));
      const active = document.querySelector(`.doc-nav-link[href="#${visible.target.id}"]`);
      active?.classList.add('active');
    },
    { rootMargin: '-80px 0px -60% 0px' }
  );

  sections.forEach(s => observer.observe(s));
}

// ───────────────────────────── 对比 Dialog 关闭 ─────────────────────────────

function bindCompareClose() {
  const dialog = document.getElementById('compare-dialog') as HTMLDialogElement;
  const closeBtn = document.getElementById('compare-close')!;
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

// ───────────────────────────── 启动 ─────────────────────────────

renderPage();
renderDeviceInfo();
bindDropzone();
bindCopyInstall();
bindDocNav();
bindCompareClose();
bindBatchDownload();
