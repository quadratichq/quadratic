import { apiClient } from '@/shared/api/apiClient';
import type { DragEvent } from 'react';
import { useCallback, useState } from 'react';
import { useRevalidator } from 'react-router';

export type DragPayload = {
  type: 'file' | 'folder';
  uuid: string;
};

/** Material Symbols icon name for each drag type */
const DRAG_ICON_NAME: Record<DragPayload['type'], string> = {
  folder: 'folder',
  file: 'description',
};

/**
 * Creates a small drag-image element reusing the existing Material Symbols icon font.
 * The element is appended off-screen so Chrome captures it, then removed next frame.
 * The offset is (0, 10) so the icon appears to the right of the cursor.
 */
function setCustomDragImage(dataTransfer: DataTransfer, type: DragPayload['type']): void {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'position:fixed;left:-9999px;top:0;display:flex;align-items:center;justify-content:center;' +
    'width:28px;height:28px;border-radius:6px;' +
    'background:#fff;border:1px solid #e5e7eb;box-shadow:0 2px 6px rgba(0,0,0,0.12);';

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined material-symbols-20';
  icon.style.cssText = 'font-size:20px;color:#6b7280;line-height:1;';
  icon.textContent = DRAG_ICON_NAME[type];
  el.appendChild(icon);

  document.body.appendChild(el);
  // Negative x pushes icon to the right; y=0 aligns top of icon with cursor tip
  dataTransfer.setDragImage(el, -8, 0);
  requestAnimationFrame(() => el.remove());
}

/**
 * Creates drag start handler props for a draggable item.
 * Sets a small custom drag image so the full card/thumbnail doesn't obscure drop targets.
 *
 * IMPORTANT: The element receiving these props must NOT be an <a> or <Link>.
 * Chrome ignores setDragImage when the draggable element is an anchor.
 * Wrap the Link inside a draggable <div> instead.
 */
export function getDragProps(payload: DragPayload) {
  return {
    draggable: true as const,
    onDragStart: (e: DragEvent) => {
      const el = e.currentTarget as HTMLElement;
      // Clear default drag data (e.g. link URL) so the browser doesn't open split view
      // or navigate when the user drags. Then set only our payload.
      e.dataTransfer.clearData();
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'move';
      setCustomDragImage(e.dataTransfer, payload.type);
      // Dim the source element so it's clear which item is being dragged
      requestAnimationFrame(() => {
        el.style.opacity = '0.4';
      });
      e.stopPropagation();
    },
    onDragEnd: (e: DragEvent) => {
      (e.currentTarget as HTMLElement).style.opacity = '';
    },
  };
}

/**
 * Hook for a drop target (a folder or the root drive).
 * Returns drop event handlers and the isOver state for visual feedback.
 */
export function useDropTarget(targetFolderUuid: string | null) {
  const [isOver, setIsOver] = useState(false);
  const revalidator = useRevalidator();

  const onDragOver = useCallback((e: DragEvent) => {
    // Always prevent default on dragOver to stop the browser from
    // treating the drop as a navigation (opening the dragged link URL)
    e.preventDefault();
    // Only show drop indicator for internal drag-and-drop, not OS file imports
    if (!e.dataTransfer.types.includes('application/json')) return;
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const onDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsOver(false);

      try {
        const data: DragPayload = JSON.parse(e.dataTransfer.getData('application/json'));

        if (data.type === 'file') {
          await apiClient.files.update(data.uuid, { folderUuid: targetFolderUuid });
        } else if (data.type === 'folder') {
          // Prevent dropping folder onto itself
          if (data.uuid === targetFolderUuid) return;
          await apiClient.folders.update(data.uuid, { parentFolderUuid: targetFolderUuid });
        }

        revalidator.revalidate();
      } catch {
        // Failed to move - revalidation will reset the UI
      }
    },
    [targetFolderUuid, revalidator]
  );

  return { isOver, onDragOver, onDragLeave, onDrop };
}
