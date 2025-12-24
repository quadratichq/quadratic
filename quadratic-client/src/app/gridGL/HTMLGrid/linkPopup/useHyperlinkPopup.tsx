import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorHyperlinks } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHyperlinks';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
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
  source: 'hover' | 'cursor' | 'inline';
  isFormula: boolean;
  // For inline editor: whether there was a text selection
  hasSelection?: boolean;
}

const FADE_DURATION = 150; // Match CSS transition duration

export function useHyperlinkPopup() {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  // Link data state - this is the "source of truth" for what popup to show
  const [linkData, setLinkData] = useState<LinkData | undefined>();
  const linkDataRef = useRef<LinkData | undefined>(undefined);

  // Display data - persists during fade-out so we keep showing content
  const [displayData, setDisplayData] = useState<LinkData | undefined>();
  const [isVisible, setIsVisible] = useState(false);
  const fadeTimeoutRef = useRef<number | undefined>(undefined);

  // Edit form state
  const [mode, setMode] = useState<PopupMode>('view');
  const [editUrl, setEditUrl] = useState('');
  const [editText, setEditText] = useState('');

  // Metadata - use displayData for consistent display during fade
  const { pageTitle } = useLinkMetadata(displayData?.url);

  // Visibility management
  const visibility = usePopupVisibility();

  // Keep a stable ref to visibility callbacks to avoid re-running useEffects when hovering state changes
  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;

  // Keep refs in sync
  useEffect(() => {
    linkDataRef.current = linkData;
  }, [linkData]);

  // Sync displayData and visibility with linkData
  useEffect(() => {
    if (linkData) {
      // Show popup with new data
      clearTimeout(fadeTimeoutRef.current);
      setDisplayData(linkData);
      setIsVisible(true);
    } else {
      // Fade out - keep displayData during fade, then clear it
      setIsVisible(false);
      fadeTimeoutRef.current = window.setTimeout(() => {
        setDisplayData(undefined);
      }, FADE_DURATION);
    }
  }, [linkData]);

  useEffect(() => {
    visibilityRef.current.setModeRef(mode);
  }, [mode]);

  // Register cursor recheck after cooldown
  const checkCursorRef = useRef<(() => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    visibilityRef.current.setAfterCooldown(() => {
      setMode('view');
      checkCursorRef.current?.();
    });
  }, []); // No dependencies - use visibilityRef

  // Close popup helper
  const closePopup = useCallback((instant = false) => {
    setLinkData(undefined);
    if (!instant) setMode('view');
    setEditUrl('');
    setEditText('');
    visibilityRef.current.triggerClose(instant);
  }, []); // No dependencies - use visibilityRef

  // Handle cursor position changes
  useEffect(() => {
    const checkCursorForHyperlink = async () => {
      if (visibilityRef.current.isEditMode()) return;
      if (visibilityRef.current.isJustClosed()) return;
      if (inlineEditorHandler.isOpen()) return;

      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      if (cursor.isMultiCursor()) return;

      const { x, y } = cursor.position;
      const cellValue = await quadraticCore.getCellValue(sheet.id, x, y);

      if (cellValue?.kind === 'RichText' && cellValue.spans) {
        // Find the first span with a link
        const linkSpan = cellValue.spans.find((span) => span.link);
        if (linkSpan?.link) {
          const offsets = sheet.getCellOffsets(x, y);
          const rect = new Rectangle(offsets.x, offsets.y, offsets.width, offsets.height);
          const codeCell = await quadraticCore.getCodeCell(sheet.id, x, y);
          const isFormula = codeCell?.language === 'Formula';

          setLinkData({ x, y, url: linkSpan.link, rect, source: 'cursor', isFormula });
          setMode('view');
          setEditUrl(linkSpan.link);
        }
      }
    };

    checkCursorRef.current = checkCursorForHyperlink;
    events.on('cursorPosition', checkCursorForHyperlink);
    return () => {
      events.off('cursorPosition', checkCursorForHyperlink);
    };
  }, []); // No dependencies - use visibilityRef

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

  // Handle inline hyperlink input (Ctrl+K in inline editor)
  useEffect(() => {
    const handleShowInlineHyperlinkInput = (data: { selectedText: string }) => {
      // Get the inline editor's position to use for the popup
      const location = inlineEditorHandler.location;
      if (!location) return;

      const sheet = sheets.sheet;
      const offsets = sheet.getCellOffsets(location.x, location.y);
      const rect = new Rectangle(offsets.x, offsets.y, offsets.width, offsets.height);

      setLinkData({
        x: location.x,
        y: location.y,
        url: '',
        rect,
        source: 'inline',
        isFormula: false,
        hasSelection: !!data.selectedText,
      });
      setMode('edit');
      setEditUrl('');
      setEditText(data.selectedText);
    };

    events.on('showInlineHyperlinkInput', handleShowInlineHyperlinkInput);
    return () => {
      events.off('showInlineHyperlinkInput', handleShowInlineHyperlinkInput);
    };
  }, []);

  // Handle cursor position on hyperlinks in inline editor (show popup when cursor is on link)
  useEffect(() => {
    const handleInlineEditorCursorOnHyperlink = (data?: { url: string; rect: Rectangle }) => {
      const v = visibilityRef.current;
      // Don't interfere with edit mode
      if (v.isEditMode()) return;

      if (data) {
        const location = inlineEditorHandler.location;
        if (!location) return;

        // Check if we're already showing this link from inline source
        const current = linkDataRef.current;
        if (current?.source === 'inline' && current?.url === data.url) return;

        // Show popup immediately (no delay for cursor-based navigation)
        setLinkData({
          x: location.x,
          y: location.y,
          url: data.url,
          rect: data.rect,
          source: 'inline',
          isFormula: false,
        });
        setMode('view');
        setEditUrl(data.url);
      } else {
        // Cursor left link - hide popup if it was from inline source
        const source = linkDataRef.current?.source;
        if (source === 'inline') {
          setLinkData(undefined);
          setMode('view');
        }
      }
    };

    events.on('inlineEditorCursorOnHyperlink', handleInlineEditorCursorOnHyperlink);
    return () => {
      events.off('inlineEditorCursorOnHyperlink', handleInlineEditorCursorOnHyperlink);
    };
  }, []);

  // Handle hover link events
  // Scenarios:
  // 1. Hovering over link → popup shows after delay
  // 2. Moving from link to popup → popup stays open (handleMouseEnter clears timeouts)
  // 3. Leaving link without going to popup → popup fades out (hoverLink undefined)
  // 4. Leaving popup → popup fades out (handleMouseLeave sets timeout, hoverLink doesn't interfere)
  useEffect(() => {
    const handleHoverLink = (link?: { x: number; y: number; url: string; rect: Rectangle }) => {
      const v = visibilityRef.current;
      if (v.isEditMode()) return;
      if (v.isJustClosed()) return;
      if (v.isHovering()) return;

      if (link) {
        // Clear timeouts when hovering a new link
        v.clearTimeouts();

        const current = linkDataRef.current;
        if (current?.x === link.x && current?.y === link.y && current?.url === link.url) return;

        v.setHoverTimeout(async () => {
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
        // Mouse left link area (hoverLink event with undefined)
        const source = linkDataRef.current?.source;

        // Don't hide popups from cursor or inline sources via hoverLink events
        if (source === 'cursor' || source === 'inline') return;

        // Scenario 2: If popup is currently being hovered, don't interfere
        // handleMouseLeave will handle hiding when mouse leaves the popup (scenario 4)
        if (v.isHovering()) return;

        // For 'hover' source popups, set fade out timeout
        // This handles both scenario 3 (never hovered popup) and scenario 4 (hovered then left)
        // handleMouseLeave also sets a timeout, but that's okay - both will try to hide it
        if (source === 'hover' && linkDataRef.current) {
          v.setFadeOutTimeout(() => {
            // Hide if still from hover source and not being hovered
            const currentSource = linkDataRef.current?.source;
            if (currentSource === 'hover' && !visibilityRef.current.isHovering()) {
              setLinkData(undefined);
              setMode('view');
            }
          }, 400);
          return;
        }

        // Edge case: Popup doesn't exist yet (shouldn't happen often)
        v.setFadeOutTimeout(() => {
          if (!linkDataRef.current) return; // Popup was already hidden
          const currentSource = linkDataRef.current.source;
          if (!visibilityRef.current.isHovering() && currentSource !== 'cursor' && currentSource !== 'inline') {
            setLinkData(undefined);
            setMode('view');
          }
        }, 400);
      }
    };

    events.on('hoverLink', handleHoverLink);
    return () => {
      events.off('hoverLink', handleHoverLink);
      visibilityRef.current.clearTimeouts();
    };
  }, []); // No dependencies - use visibilityRef to access current visibility

  // Hide on viewport changes
  useEffect(() => {
    const hide = () => {
      if (visibilityRef.current.isEditMode()) return;
      setLinkData(undefined);
      setMode('view');
    };

    pixiApp.viewport.on('moved', hide);
    pixiApp.viewport.on('zoomed', hide);
    return () => {
      pixiApp.viewport.off('moved', hide);
      pixiApp.viewport.off('zoomed', hide);
    };
  }, []); // No dependencies - use visibilityRef

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

  // Mouse handlers - use useCallback with visibilityRef to avoid re-creating when hovering changes
  const handleMouseEnter = useCallback(() => {
    visibilityRef.current.handleMouseEnter();
  }, []);

  const handleMouseMove = useCallback(() => {
    visibilityRef.current.handleMouseMove();
  }, []);
  const handleMouseLeave = useCallback(() => {
    visibilityRef.current.handleMouseLeave(() => {
      const source = linkDataRef.current?.source;
      // Don't auto-hide for cursor or inline sources
      if (source !== 'cursor' && source !== 'inline') {
        setLinkData(undefined);
        setMode('view');
      }
    });
  }, []); // No dependencies - use visibilityRef

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
      // Close popup immediately before any async operations
      closePopup(true);
      sheets.sheet.cursor.moveTo(linkData.x, linkData.y);
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

    if (linkData.source === 'inline') {
      // Save to inline editor's hyperlink tracking
      inlineEditorHyperlinks.completePendingHyperlink(normalizedUrl, text);
      inlineEditorMonaco.focus();
    } else {
      // Save directly to cell
      quadraticCore.setCellRichText(sheets.current, linkData.x, linkData.y, [
        {
          text,
          link: normalizedUrl,
          bold: null,
          italic: null,
          underline: null,
          strike_through: null,
          text_color: null,
          font_size: null,
        },
      ]);
    }
    closePopup(true);
  }, [linkData, editUrl, editText, closePopup]);

  const handleCancelEdit = useCallback(() => {
    if (linkData?.source === 'inline') {
      inlineEditorHyperlinks.cancelPendingHyperlink();
      inlineEditorMonaco.focus();
    }
    closePopup(true);
  }, [linkData, closePopup]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Stop propagation to prevent grid from capturing keyboard events
      e.stopPropagation();

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

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    // Stop propagation to prevent grid from capturing keyboard events
    e.stopPropagation();
  }, []);

  // When editing in inline mode with a text selection, hide the text field
  const hideTextField = displayData?.source === 'inline' && displayData?.hasSelection;

  return {
    // Use displayData for rendering (persists during fade-out)
    linkData: displayData,
    mode,
    editUrl,
    editText,
    pageTitle,
    isVisible,
    skipFade: visibility.skipFade,
    hideTextField,
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
    handleKeyUp,
  };
}
