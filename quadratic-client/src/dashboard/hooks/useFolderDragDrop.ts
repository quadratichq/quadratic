import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import type { DragEvent } from 'react';
import { useCallback, useState } from 'react';
import { useNavigate, useParams, useRevalidator } from 'react-router';

export type DragPayload = {
  type: 'file' | 'folder';
  uuid: string;
  /** null = team item, number = private item (owner's user ID) */
  ownerUserId: number | null;
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
function setIconDragImage(dataTransfer: DataTransfer, type: DragPayload['type']): void {
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
 * Creates a small thumbnail drag-image by drawing the already-loaded thumbnail
 * onto a `<canvas>`. This avoids the blank-image problem that occurs when a
 * freshly-created `<img>` element hasn't decoded yet at the time `setDragImage`
 * captures its snapshot.  Returns false if no loaded thumbnail is available,
 * so the caller can fall back to the icon approach.
 */
function setThumbnailDragImage(dataTransfer: DataTransfer, sourceEl: HTMLElement): boolean {
  const img = sourceEl.querySelector('img[alt="File thumbnail screenshot"]') as HTMLImageElement | null;
  if (!img || !img.naturalWidth) return false;

  const WIDTH = 56;
  const HEIGHT = Math.round((WIDTH * 9) / 16); // 16:9 aspect ratio
  const RADIUS = 4;
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  canvas.style.cssText = `position:fixed;left:-9999px;top:0;width:${WIDTH}px;height:${HEIGHT}px;`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.scale(dpr, dpr);

  // Clip to a rounded rectangle
  ctx.beginPath();
  ctx.roundRect(0, 0, WIDTH, HEIGHT, RADIUS);
  ctx.clip();

  // Draw the already-loaded thumbnail synchronously
  ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

  // Thin border
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1, RADIUS);
  ctx.stroke();

  document.body.appendChild(canvas);
  dataTransfer.setDragImage(canvas, -8, 0);
  requestAnimationFrame(() => canvas.remove());
  return true;
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
      // For files, prefer the actual thumbnail as the drag image; fall back to an icon
      if (payload.type !== 'file' || !setThumbnailDragImage(e.dataTransfer, el)) {
        setIconDragImage(e.dataTransfer, payload.type);
      }
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
 *
 * @param targetFolderUuid - The folder to move into, or null for root
 * @param targetOwnerUserId - Optional ownership context. When provided and different
 *   from the dragged item's ownership, the item's ownership will be updated to match.
 */
export function useDropTarget(targetFolderUuid: string | null, targetOwnerUserId?: number | null) {
  const [isOver, setIsOver] = useState(false);
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const { teamUuid } = useParams<{ teamUuid: string }>();
  const { addGlobalSnackbar } = useGlobalSnackbar();

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
        const needsOwnershipChange = targetOwnerUserId !== undefined && data.ownerUserId !== targetOwnerUserId;

        if (data.type === 'file') {
          // When moving to a specific folder, the API auto-adjusts file ownership.
          // When moving to root with ownership change, send both in one call for atomicity.
          if (needsOwnershipChange && targetFolderUuid === null) {
            await apiClient.files.update(data.uuid, {
              folderUuid: null,
              ownerUserId: targetOwnerUserId ?? undefined,
            });
          } else {
            await apiClient.files.update(data.uuid, { folderUuid: targetFolderUuid });
          }
        } else if (data.type === 'folder') {
          // Prevent dropping folder onto itself
          if (data.uuid === targetFolderUuid) return;

          if (needsOwnershipChange) {
            // Moving between Team Files and Private Files: API updates ownerUserId on this
            // folder and recursively on all descendant folders and files.
            await apiClient.folders.update(data.uuid, {
              parentFolderUuid: targetFolderUuid,
              ownerUserId: targetOwnerUserId,
            });
          } else {
            await apiClient.folders.update(data.uuid, { parentFolderUuid: targetFolderUuid });
          }
        }

        revalidator.revalidate();

        // After moving a folder, navigate to the target folder so the user can see the result
        if (data.type === 'folder' && targetFolderUuid && teamUuid) {
          navigate(ROUTES.TEAM_DRIVE_FOLDER(teamUuid, targetFolderUuid));
        }
      } catch (err) {
        console.error('Failed to move item:', err);
        addGlobalSnackbar('Failed to move item. Try again.', { severity: 'error' });
      }
    },
    [targetFolderUuid, targetOwnerUserId, revalidator, navigate, teamUuid, addGlobalSnackbar]
  );

  return { isOver, onDragOver, onDragLeave, onDrop };
}

/**
 * Hook for a section-level drop target ("Team Files" or "Private Files").
 * Drops move the item to the root of the target section and change ownership.
 *
 * @param targetOwnerUserId - null for team section, user ID for private section
 */
export function useOwnershipDropTarget(targetOwnerUserId: number | null) {
  return useDropTarget(null, targetOwnerUserId);
}
