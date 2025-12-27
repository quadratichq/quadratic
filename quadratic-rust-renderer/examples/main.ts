/**
 * Quadratic Rust Renderer - Demo Application
 *
 * Main entry point for the demo application.
 * Handles initialization, font loading, and lazy-loading of cell data.
 */

import { loadFontTextures, parseBMFont } from './font-loader';
import { ViewportControls } from './ViewportControls';
import RenderWorker from './worker?worker';

// DOM Elements
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLElement;
const fpsEl = document.getElementById('fps') as HTMLElement;
const zoomEl = document.getElementById('zoom') as HTMLElement;
const frametimeEl = document.getElementById('frametime') as HTMLElement;
const labelsEl = document.getElementById('labels') as HTMLElement;
const hashesEl = document.getElementById('hashes') as HTMLElement;
const spriteMemEl = document.getElementById('sprite-mem') as HTMLElement;
const renderIndicatorEl = document.getElementById('render-indicator') as HTMLElement;
const backendToggleEl = document.getElementById('backend-toggle') as HTMLElement;
const backendNameEl = document.getElementById('backend-name') as HTMLElement;

// LocalStorage key for backend preference
const BACKEND_STORAGE_KEY = 'quadratic-renderer-backend';

let worker: Worker | null = null;
let viewportControls: ViewportControls | null = null;
let fontsReady = false;
let currentBackend: 'webgpu' | 'webgl' = 'webgl';
let webgpuAvailable = false;

// Helper to get stored backend preference
function getStoredBackendPreference(): 'webgpu' | 'webgl' | null {
  const stored = localStorage.getItem(BACKEND_STORAGE_KEY);
  if (stored === 'webgpu' || stored === 'webgl') {
    return stored;
  }
  return null;
}

// Helper to save backend preference
function saveBackendPreference(backend: 'webgpu' | 'webgl'): void {
  localStorage.setItem(BACKEND_STORAGE_KEY, backend);
}

// Update the backend indicator UI
function updateBackendIndicator(backend: 'webgpu' | 'webgl', available: boolean): void {
  currentBackend = backend;
  webgpuAvailable = available;

  backendNameEl.textContent = backend === 'webgpu' ? 'WebGPU' : 'WebGL';

  // Update tooltip based on availability
  if (available) {
    backendToggleEl.title = 'Click to switch to ' + (backend === 'webgpu' ? 'WebGL' : 'WebGPU');
  } else {
    backendToggleEl.title = 'WebGPU not available in this browser';
    backendToggleEl.style.cursor = 'default';
  }
}

// Helper to update render indicator
function updateRenderIndicator(rendering: boolean): void {
  renderIndicatorEl.className = 'render-indicator ' + (rendering ? 'rendering' : 'idle');
}

// =========================================================================
// Simulated Data Source (in real app, this would be core/backend)
// =========================================================================

// Config for our "virtual" infinite grid
const COLS = 20; // More columns to make it feel like a real spreadsheet
const HASH_WIDTH = 15; // Cells per hash (must match Rust)
const HASH_HEIGHT = 30;

// Random data generator - creates deterministic data based on position
function generateCellText(col: number, row: number): string {
  // Use a simple hash of position for deterministic "random" data
  const seed = ((col * 31337 + row * 7919) >>> 0);
  const types = ['text', 'number', 'date', 'formula'];
  const type = types[seed % 4];

  switch (type) {
    case 'text': {
      const words = [
        'Hello',
        'World',
        'Data',
        'Test',
        'Value',
        'Row',
        'Col',
        'Alpha',
        'Beta',
        'Gamma',
      ];
      return words[(seed >> 2) % words.length];
    }
    case 'number':
      return ((seed % 10000) / 100).toFixed(2);
    case 'date': {
      const day = 1 + (seed % 28);
      const month = 1 + ((seed >> 5) % 12);
      const year = 2020 + ((seed >> 9) % 6);
      return `${month}/${day}/${year}`;
    }
    case 'formula':
      return '=' + (seed % 100) + '+' + ((seed >> 8) % 100);
    default:
      return '';
  }
}

interface Label {
  text: string;
  col: number;
  row: number;
  color?: { r: number; g: number; b: number };
}

// Predefined colors for variety (10% of cells will be colored)
const CELL_COLORS = [
  { r: 0.8, g: 0.2, b: 0.2 },  // Red
  { r: 0.2, g: 0.6, b: 0.2 },  // Green
  { r: 0.2, g: 0.4, b: 0.8 },  // Blue
  { r: 0.7, g: 0.4, b: 0.0 },  // Orange
  { r: 0.6, g: 0.2, b: 0.6 },  // Purple
  { r: 0.0, g: 0.6, b: 0.6 },  // Teal
];

// Generate all labels for a specific hash
function generateHashLabels(hashX: number, hashY: number): Label[] {
  const labels: Label[] = [];

  // Calculate cell range for this hash
  const startCol = hashX * HASH_WIDTH;
  const startRow = hashY * HASH_HEIGHT;
  const endCol = startCol + HASH_WIDTH;
  const endRow = startRow + HASH_HEIGHT;

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      if (col >= 0 && row >= 0 && col < COLS) {
        const seed = ((col * 31337 + row * 7919) >>> 0);
        // SheetOffsets uses 1-indexed columns/rows (A1 notation)
        const label: Label = {
          text: generateCellText(col, row),
          col: col + 1,
          row: row + 1,
        };

        // 10% of cells get a random color
        if (seed % 10 === 0) {
          label.color = CELL_COLORS[seed % CELL_COLORS.length];
        }

        labels.push(label);
      }
    }
  }

  return labels;
}

// =========================================================================
// Lazy Loading Logic
// =========================================================================

const loadingHashes = new Set<string>(); // Hashes currently being loaded (to avoid duplicate requests)

// Load a specific hash (simulating data fetch from core)
// In a real app, this would fetch from the backend instead of generating
async function loadHash(hashX: number, hashY: number): Promise<void> {
  const key = `${hashX},${hashY}`;
  if (loadingHashes.has(key)) return;
  loadingHashes.add(key);

  // Generate labels for this hash (simulates fetching from backend)
  const labels = generateHashLabels(hashX, hashY);

  // Send labels to Rust renderer
  for (const label of labels) {
    if (label.color) {
      // Use styled label for colored text
      worker?.postMessage({
        type: 'addStyledLabel',
        text: label.text,
        col: label.col,
        row: label.row,
        colorR: label.color.r,
        colorG: label.color.g,
        colorB: label.color.b,
      });
    } else {
      // Use simple label for default black text
      worker?.postMessage({
        type: 'addLabel',
        text: label.text,
        col: label.col,
        row: label.row,
      });
    }
  }

  loadingHashes.delete(key);

  // Update UI with counts from Rust (source of truth)
  updateStatsDisplay();
}

// Unload a specific hash - just tell Rust to remove it
function unloadHash(hashX: number, hashY: number): void {
  worker?.postMessage({ type: 'removeHash', hashX, hashY });
  updateStatsDisplay();
}

// Update stats display from Rust (the source of truth)
function updateStatsDisplay(): void {
  worker?.postMessage({ type: 'getStats' });
}

// Check which hashes need to be loaded/unloaded
function updateVisibleHashes(): void {
  if (!worker || !fontsReady) return;

  // Ask Rust which hashes are needed and which are offscreen
  worker.postMessage({ type: 'getNeededHashes' });
  worker.postMessage({ type: 'getOffscreenHashes' });
}

// =========================================================================
// Canvas Setup
// =========================================================================

// Check for OffscreenCanvas support
if (!('transferControlToOffscreen' in canvas)) {
  statusEl.textContent = 'Error: OffscreenCanvas not supported';
  statusEl.className = 'error';
  throw new Error('OffscreenCanvas not supported');
}

function initCanvasSize(): void {
  // Canvas sizing is handled by CSS (width: 100%, height: 100%)
  // We just need to set the canvas buffer size based on CSS size * DPR
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
}

// =========================================================================
// Worker Message Types
// =========================================================================

interface FpsMessage {
  type: 'fps';
  fps: number;
  frameTime: string;
  rendering?: boolean;
  zoom?: number;
}

interface RenderStatusMessage {
  type: 'renderStatus';
  rendering: boolean;
}

interface NeededHashesMessage {
  type: 'neededHashes';
  hashes: number[];
}

interface OffscreenHashesMessage {
  type: 'offscreenHashes';
  hashes: number[];
}

interface StatsMessage {
  type: 'stats';
  hashCount: number;
  labelCount: number;
  spriteCount: number;
  spriteMemoryBytes: number;
}

interface ReadyMessage {
  type: 'ready';
  backend?: 'webgpu' | 'webgl';
  webgpuAvailable?: boolean;
}

interface BackendInfoMessage {
  type: 'backendInfo';
  backend: 'webgpu' | 'webgl';
  webgpuAvailable: boolean;
}

interface ViewportMovedMessage {
  type: 'viewportMoved';
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type WorkerResponse =
  | FpsMessage
  | RenderStatusMessage
  | NeededHashesMessage
  | OffscreenHashesMessage
  | StatsMessage
  | ReadyMessage
  | BackendInfoMessage
  | ViewportMovedMessage
  | ErrorMessage;

// =========================================================================
// Initialize
// =========================================================================

async function init(): Promise<void> {
  try {
    const offscreen = canvas.transferControlToOffscreen();
    worker = new RenderWorker();

    // Set up viewport controls using the extracted module
    viewportControls = new ViewportControls(canvas, {
      sendMessage: (msg) => worker?.postMessage(msg),
      onViewportChange: updateVisibleHashes,
      onViewportChangeImmediate: updateVisibleHashes,
      handleResize: true,
    });

    worker.onmessage = async (e: MessageEvent<WorkerResponse>): Promise<void> => {
      const data = e.data;

      switch (data.type) {
        case 'ready':
          statusEl.textContent = 'Loading fonts…';
          statusEl.className = 'loading';

          // Update backend indicator
          if (data.backend && data.webgpuAvailable !== undefined) {
            updateBackendIndicator(data.backend, data.webgpuAvailable);
            // Save the actual backend being used (in case WebGPU wasn't available)
            saveBackendPreference(data.backend);
          }

          // Trigger initial resize
          viewportControls?.triggerResize();

          // Set DPR for headings font scaling
          const dpr = window.devicePixelRatio || 1;
          worker?.postMessage({ type: 'setHeadingsDpr', dpr });

          worker?.postMessage({ type: 'toggleFps', enabled: true });

          // Load fonts
          try {
            const fontData = await parseBMFont('./fonts/OpenSans.fnt');
            worker?.postMessage({ type: 'addFont', fontJson: JSON.stringify(fontData) });

            const textures = await loadFontTextures(fontData, './fonts');
            for (let i = 0; i < textures.length; i++) {
              const img = textures[i];
              if (!img) continue;
              const bitmap = await createImageBitmap(img);
              worker?.postMessage({ type: 'uploadFontTexture', textureUid: i, bitmap }, [bitmap]);
            }

            fontsReady = true;
            statusEl.textContent = 'Ready – scroll to explore';
            statusEl.className = 'ready';

            // Load initial visible hashes
            updateVisibleHashes();

            // Show canvas now that everything is ready
            canvas.classList.add('ready');
          } catch (error) {
            console.error('Font loading error:', error);
            statusEl.textContent = 'Error loading fonts: ' + (error as Error).message;
            statusEl.className = 'error';
          }
          break;

        case 'fps':
          fpsEl.textContent = String(data.fps);
          frametimeEl.textContent = data.frameTime + ' ms';
          fpsEl.className =
            'stat-value ' +
            (data.fps >= 55 ? 'fps-green' : data.fps >= 30 ? 'fps-yellow' : 'fps-red');
          // Update zoom level
          if (data.zoom !== undefined) {
            zoomEl.textContent = Math.round(data.zoom * 100) + '%';
          }
          // Also update render indicator if included
          if (data.rendering !== undefined) {
            updateRenderIndicator(data.rendering);
          }
          break;

        case 'renderStatus':
          updateRenderIndicator(data.rendering);
          break;

        case 'neededHashes': {
          // Load each needed hash
          const neededHashes = data.hashes;
          for (let i = 0; i < neededHashes.length; i += 2) {
            const hashX = neededHashes[i];
            const hashY = neededHashes[i + 1];
            loadHash(hashX, hashY);
          }
          break;
        }

        case 'offscreenHashes': {
          // Unload each offscreen hash
          const offscreenHashes = data.hashes;
          for (let i = 0; i < offscreenHashes.length; i += 2) {
            const hashX = offscreenHashes[i];
            const hashY = offscreenHashes[i + 1];
            unloadHash(hashX, hashY);
          }
          break;
        }

        case 'stats':
          // Update UI with counts from Rust (source of truth)
          labelsEl.textContent = data.labelCount.toLocaleString();
          hashesEl.textContent = data.hashCount.toLocaleString();
          // Format sprite memory as human-readable (KB or MB)
          if (data.spriteMemoryBytes > 0) {
            const kb = data.spriteMemoryBytes / 1024;
            const mb = kb / 1024;
            spriteMemEl.textContent = mb >= 1
              ? `${mb.toFixed(1)} MB (${data.spriteCount})`
              : `${Math.round(kb)} KB (${data.spriteCount})`;
          } else {
            spriteMemEl.textContent = '0';
          }
          break;

        case 'viewportMoved':
          // Viewport moved due to deceleration - notify controls
          viewportControls?.notifyViewportMoved();
          break;

        case 'backendInfo':
          updateBackendIndicator(data.backend, data.webgpuAvailable);
          break;

        case 'error':
          statusEl.textContent = 'Error: ' + data.message;
          statusEl.className = 'error';
          break;
      }
    };

    // Set up backend toggle click handler
    backendToggleEl.addEventListener('click', () => {
      if (!webgpuAvailable) {
        // Can't toggle if WebGPU isn't available
        return;
      }

      // Toggle to the other backend
      const newBackend = currentBackend === 'webgpu' ? 'webgl' : 'webgpu';
      saveBackendPreference(newBackend);

      // Reload the page to apply the new backend
      // (Worker can't recreate the renderer without a new canvas transfer)
      window.location.reload();
    });

    // Get stored backend preference - default to WebGPU if available
    const storedPref = getStoredBackendPreference();
    const preferWebGPU = storedPref === null ? true : storedPref === 'webgpu';

    worker.postMessage({ type: 'init', canvas: offscreen, preferWebGPU }, [offscreen]);
  } catch (error) {
    statusEl.textContent = 'Error: ' + (error as Error).message;
    statusEl.className = 'error';
    console.error('Init error:', error);
  }
}

// =========================================================================
// Keyboard Controls (not part of ViewportControls - app-specific)
// =========================================================================

let cursorCol = 0;
let cursorRow = 0;

document.addEventListener('keydown', (e: KeyboardEvent): void => {
  switch (e.key) {
    case 'ArrowLeft':
      cursorCol = Math.max(0, cursorCol - 1);
      break;
    case 'ArrowRight':
      cursorCol++;
      break;
    case 'ArrowUp':
      cursorRow = Math.max(0, cursorRow - 1);
      break;
    case 'ArrowDown':
      cursorRow++;
      break;
    default:
      return;
  }
  e.preventDefault();
  worker?.postMessage({ type: 'setCursor', col: cursorCol, row: cursorRow });
});

// Start after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initCanvasSize();
    init();
  });
} else {
  initCanvasSize();
  init();
}
