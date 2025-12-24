import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { openLink } from '@/app/helpers/links';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CopyIcon } from '@/shared/components/Icons';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLinkMetadata } from './useLinkMetadata';
import type { PopupMode } from './usePopupVisibility';
import { usePopupVisibility } from './usePopupVisibility';

const HOVER_DELAY = 300;

export interface LinkData {
  x: number;
  y: number;
  url: string;
  rect: Rectangle;
  source: 'hover' | 'cursor';
  isFormula: boolean;
}

export function useHyperlinkPopup() {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  // Link data state
  const [linkData, setLinkData] = useState<LinkData | undefined>();
  const linkDataRef = useRef<LinkData | undefined>();

  // Edit form state
  const [mode, setMode] = useState<PopupMode>('view');
  const [editUrl, setEditUrl] = useState('');
  const [editText, setEditText] = useState('');

  // Metadata
  const { pageTitle } = useLinkMetadata(linkData?.url);

  // Visibility management
  const visibility = usePopupVisibility();

  // Keep refs in sync
  useEffect(() => {
    linkDataRef.current = linkData;
  }, [linkData]);

  useEffect(() => {
    visibility.setModeRef(mode);
  }, [mode, visibility]);

  // Register cursor recheck after cooldown
  const checkCursorRef = useRef<(() => Promise<void>) | undefined>();
  useEffect(() => {
    visibility.setAfterCooldown(() => {
      setMode('view');
      checkCursorRef.current?.();
    });
  }, [visibility]);

  // Close popup helper
  const closePopup = useCallback(
    (instant = false) => {
      setLinkData(undefined);
      if (!instant) setMode('view');
      setEditUrl('');
      setEditText('');
      visibility.triggerClose(instant);
    },
    [visibility]
  );

  // Handle cursor position changes
  useEffect(() => {
    const checkCursorForHyperlink = async () => {
      if (visibility.isEditMode()) return;
      if (visibility.isJustClosed()) return;
      if (inlineEditorHandler.isOpen()) return;

      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      if (cursor.isMultiCursor()) return;

      const { x, y } = cursor.position;
      const cellValue = await quadraticCore.getCellValue(sheet.id, x, y);

      if (cellValue?.kind === 'RichText') {
        const displayValue = await quadraticCore.getDisplayCell(sheet.id, x, y);
        if (displayValue) {
          const offsets = sheet.getCellOffsets(x, y);
          const rect = new Rectangle(offsets.x, offsets.y, offsets.width, offsets.height);
          const codeCell = await quadraticCore.getCodeCell(sheet.id, x, y);
          const isFormula = codeCell?.language === 'Formula';

          setLinkData({ x, y, url: displayValue, rect, source: 'cursor', isFormula });
          setMode('view');
          setEditUrl(displayValue);
        }
      }
    };

    checkCursorRef.current = checkCursorForHyperlink;
    events.on('cursorPosition', checkCursorForHyperlink);
    return () => {
      events.off('cursorPosition', checkCursorForHyperlink);
    };
  }, [visibility]);

  // Handle insert link event
  useEffect(() => {
    const handleInsertLink = () => {
      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      if (cursor.isMultiCursor()) return;

      const { x, y } = cursor.position;
      const offsets = sheet.getCellOffsets(x, y);
      const rect = new Rectangle(offsets.x, offsets.y, offsets.width, offsets.height);

      setLinkData({ x, y, url: '', rect, source: 'cursor', isFormula: false });
      setMode('edit');
      setEditUrl('');
      setEditText('');
    };

    events.on('insertLink', handleInsertLink);
    return () => {
      events.off('insertLink', handleInsertLink);
    };
  }, []);

  // Handle hover link events
  useEffect(() => {
    const handleHoverLink = (link?: { x: number; y: number; url: string; rect: Rectangle }) => {
      if (visibility.isEditMode()) return;
      if (visibility.isJustClosed()) return;
      if (visibility.isHovering()) return;

      visibility.clearTimeouts();

      if (link) {
        const current = linkDataRef.current;
        if (current?.x === link.x && current?.y === link.y && current?.url === link.url) return;

        visibility.setHoverTimeout(async () => {
          const sheet = sheets.sheet;
          const offsets = sheet.getCellOffsets(link.x, link.y);
          const cellRect = new Rectangle(offsets.x, offsets.y, offsets.width, offsets.height);
          const codeCell = await quadraticCore.getCodeCell(sheet.id, link.x, link.y);
          const isFormula = codeCell?.language === 'Formula';

          setLinkData({ x: link.x, y: link.y, url: link.url, rect: cellRect, source: 'hover', isFormula });
          setMode('view');
          setEditUrl(link.url);
        }, HOVER_DELAY);
      } else {
        if (linkDataRef.current?.source === 'cursor') return;

        visibility.setFadeOutTimeout(() => {
          if (!visibility.isHovering() && linkDataRef.current?.source !== 'cursor') {
            setLinkData(undefined);
            setMode('view');
          }
        }, 400);
      }
    };

    events.on('hoverLink', handleHoverLink);
    return () => {
      events.off('hoverLink', handleHoverLink);
      visibility.clearTimeouts();
    };
  }, [visibility]);

  // Hide on viewport changes
  useEffect(() => {
    const hide = () => {
      if (visibility.isEditMode()) return;
      setLinkData(undefined);
      setMode('view');
    };

    pixiApp.viewport.on('moved', hide);
    pixiApp.viewport.on('zoomed', hide);
    return () => {
      pixiApp.viewport.off('moved', hide);
      pixiApp.viewport.off('zoomed', hide);
    };
  }, [visibility]);

  // Hide when inline editor opens
  useEffect(() => {
    const handleChangeInput = (input: boolean) => {
      if (input) {
        setLinkData(undefined);
        setMode('view');
      }
    };

    events.on('changeInput', handleChangeInput);
    return () => {
      events.off('changeInput', handleChangeInput);
    };
  }, []);

  // Mouse handlers (wrap visibility handlers)
  const handleMouseEnter = visibility.handleMouseEnter;
  const handleMouseMove = visibility.handleMouseMove;
  const handleMouseLeave = useCallback(() => {
    visibility.handleMouseLeave(() => {
      if (linkDataRef.current?.source !== 'cursor') {
        setLinkData(undefined);
        setMode('view');
      }
    });
  }, [visibility]);

  // Action handlers
  const handleOpenLink = useCallback(() => {
    if (linkData?.url) openLink(linkData.url);
  }, [linkData]);

  const handleCopyLink = useCallback(async () => {
    if (linkData?.url) {
      await navigator.clipboard.writeText(linkData.url);
      addGlobalSnackbar(
        <span className="flex items-center gap-1">
          <CopyIcon />
          Copied link to clipboard.
        </span>
      );
    }
  }, [linkData, addGlobalSnackbar]);

  const handleEditMode = useCallback(async () => {
    if (!linkData) return;

    if (linkData.isFormula) {
      sheets.sheet.cursor.moveTo(linkData.x, linkData.y);
      closePopup();
      const codeCell = await quadraticCore.getCodeCell(sheets.current, linkData.x, linkData.y);
      if (codeCell?.code_string) {
        pixiAppSettings.changeInput(true, '=' + codeCell.code_string);
      }
      return;
    }

    const displayValue = await quadraticCore.getDisplayCell(sheets.current, linkData.x, linkData.y);
    setEditText(displayValue && displayValue !== linkData.url ? displayValue : '');
    setEditUrl(linkData.url);
    setMode('edit');
  }, [linkData, closePopup]);

  const handleRemoveLink = useCallback(() => {
    if (!linkData) return;

    quadraticCore.getDisplayCell(sheets.current, linkData.x, linkData.y).then((displayValue) => {
      if (displayValue) {
        quadraticCore.setCellValue(sheets.current, linkData.x, linkData.y, displayValue, false);
      }
      setLinkData(undefined);
      setMode('view');
    });
  }, [linkData]);

  const handleSaveEdit = useCallback(() => {
    if (!linkData || !editUrl.trim()) return;

    const normalizedUrl = editUrl.match(/^https?:\/\//i) ? editUrl : `https://${editUrl}`;
    const text = editText.trim() || normalizedUrl;
    quadraticCore.setCellRichText(sheets.current, linkData.x, linkData.y, [{ text, link: normalizedUrl }]);
    closePopup(true);
  }, [linkData, editUrl, editText, closePopup]);

  const handleCancelEdit = useCallback(() => {
    closePopup(true);
  }, [closePopup]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  return {
    linkData,
    mode,
    editUrl,
    editText,
    pageTitle,
    isVisible: linkData !== undefined,
    skipFade: visibility.skipFade,
    setEditUrl,
    setEditText,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
    handleOpenLink,
    handleCopyLink,
    handleEditMode,
    handleRemoveLink,
    handleSaveEdit,
    handleCancelEdit,
    handleKeyDown,
  };
}
