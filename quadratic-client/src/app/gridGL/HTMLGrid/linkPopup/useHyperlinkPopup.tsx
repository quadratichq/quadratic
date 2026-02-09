import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { inlineEditorSpans } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorSpans';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { focusGrid } from '@/app/helpers/focusGrid';
import { ensureHttpProtocol, hasHttpProtocol, openLink } from '@/app/helpers/links';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CopyIcon } from '@/shared/components/Icons';
import type { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLinkMetadata } from './useLinkMetadata';
import { FADE_OUT_DELAY, type PopupMode, usePopupVisibility } from './usePopupVisibility';

// Helper to get cell bounds, accounting for merged cells
function getCellBounds(sheet: Sheet, x: number, y: number): Rectangle {
  const mergeRect = sheet.getMergeCellRect(x, y);
  if (mergeRect) {
    return sheet.getScreenRectangle(
      Number(mergeRect.min.x),
      Number(mergeRect.min.y),
      Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
      Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
    );
  }
  return sheet.getCellOffsets(x, y);
}

const HOVER_DELAY = 500;

export interface LinkData {
  x: number;
  y: number;
  url: string;
  rect: Rectangle;
  source: 'hover' | 'cursor' | 'inline';
  isFormula: boolean;
  // For inline editor: whether there was a text selection
  hasSelection?: boolean;
  // For partial hyperlinks: the text of the link span
  linkText?: string;
  // True if this is a naked URL (plain text auto-detected as URL, not a RichText hyperlink)
  isNakedUrl?: boolean;
  // Character start position of this hyperlink span within the cell text
  spanStart?: number;
  // Character end position of this hyperlink span within the cell text
  spanEnd?: number;
  // True if this is creating a new link (should replace entire cell content on save)
  isNewLink?: boolean;
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
  const modeRef = useRef<PopupMode>('view');
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

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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
  const checkCursorRef = useRef<(() => void) | undefined>(undefined);
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
    const checkCursorForHyperlink = () => {
      const v = visibilityRef.current;
      if (v.isEditMode()) return;
      if (v.isJustClosed()) return;
      if (inlineEditorHandler.isOpen()) return;

      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      if (cursor.isMultiCursor()) {
        v.clearTimeouts();
        return;
      }

      let { x, y } = cursor.position;

      // If the cursor is on a merged cell, use the top-left cell of the merge
      // since that's where the data is stored
      const mergeRect = sheet.getMergeCellRect(x, y);
      if (mergeRect) {
        x = Number(mergeRect.min.x);
        y = Number(mergeRect.min.y);
      }

      // Close cursor-sourced popup if cursor moved to a different cell
      // Close cursor-sourced popup if cursor moved to a different cell
      const current = linkDataRef.current;
      if (current?.source === 'cursor' && (current.x !== x || current.y !== y)) {
        setLinkData(undefined);
        setMode('view');
      }

      // Clear any existing timeout and set a new one with delay
      v.clearTimeouts();
      v.setHoverTimeout(async () => {
        // Re-check conditions after delay
        if (v.isEditMode()) return;
        if (v.isJustClosed()) return;
        if (inlineEditorHandler.isOpen()) return;

        // Verify cursor is still at the same position (check original position)
        const currentCursor = sheets.sheet.cursor;
        if (currentCursor.isMultiCursor()) return;
        const currentPos = currentCursor.position;

        // For merged cells, check if cursor is still within the same merge
        const currentMergeRect = sheet.getMergeCellRect(currentPos.x, currentPos.y);
        if (mergeRect && currentMergeRect) {
          // Both positions are in merged cells - check if it's the same merge
          if (Number(currentMergeRect.min.x) !== x || Number(currentMergeRect.min.y) !== y) {
            return;
          }
        } else if (currentPos.x !== x || currentPos.y !== y) {
          return;
        }

        const cellValue = await quadraticCore.getCellValue(sheet.id, x, y);

        if (cellValue?.kind === 'RichText' && cellValue.spans) {
          // Only show popup from cursor if the entire cell is a single hyperlink span.
          // For partial hyperlinks (multiple spans with only some having links),
          // rely on hover detection which knows the exact mouse position.
          const linkSpan = cellValue.spans.length === 1 ? cellValue.spans[0] : undefined;
          const linkUrl = linkSpan?.link;
          if (linkSpan && linkUrl) {
            const rect = getCellBounds(sheet, x, y);
            const codeCell = await quadraticCore.getCodeCell(sheet.id, x, y);
            const isFormula = codeCell?.language === 'Formula';

            setLinkData({ x, y, url: linkUrl, rect, source: 'cursor', isFormula, linkText: linkSpan.text });
            setMode('view');
            setEditUrl(linkUrl);
          }
        }
      }, HOVER_DELAY);
    };

    checkCursorRef.current = checkCursorForHyperlink;
    events.on('cursorPosition', checkCursorForHyperlink);
    return () => {
      events.off('cursorPosition', checkCursorForHyperlink);
      visibilityRef.current.clearTimeouts();
    };
  }, []); // No dependencies - use visibilityRef

  // Handle insert link event
  useEffect(() => {
    const handleInsertLink = async () => {
      // Don't handle insertLink when inline editor is open - use showInlineHyperlinkInput instead
      if (inlineEditorHandler.isOpen()) return;

      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      if (cursor.isMultiCursor()) return;

      let { x, y } = cursor.position;

      // If the cursor is on a merged cell, use the top-left cell of the merge
      const mergeRect = sheet.getMergeCellRect(x, y);
      if (mergeRect) {
        x = Number(mergeRect.min.x);
        y = Number(mergeRect.min.y);
      }

      const rect = getCellBounds(sheet, x, y);

      try {
        // Check if the cell is a single-span hyperlink (entire cell is one link)
        const cellValue = await quadraticCore.getCellValue(sheet.id, x, y);
        const isSingleSpanHyperlink =
          cellValue?.kind === 'RichText' && cellValue.spans?.length === 1 && cellValue.spans[0].link;
        const linkSpan = isSingleSpanHyperlink ? cellValue.spans![0] : undefined;

        let urlValue = '';
        let textValue = '';
        let isNewLink = false;

        if (linkSpan) {
          // Cell is a single hyperlink span - pre-populate URL and text for editing
          urlValue = linkSpan.link ?? '';
          // Only set text if it differs from the URL
          textValue = linkSpan.text !== linkSpan.link ? linkSpan.text : '';
        } else {
          // Rich text with multiple spans or plain text - user wants to create a new link
          // Get the plain text display value for the text field, leave URL blank
          isNewLink = true;
          const displayValue = await quadraticCore.getDisplayCell(sheet.id, x, y);
          if (displayValue && hasHttpProtocol(displayValue)) {
            // Content is a URL - pre-populate URL field, leave text empty
            urlValue = displayValue;
          } else {
            // Content is not a URL - pre-populate text field with plain text value
            textValue = displayValue ?? '';
          }
        }

        setLinkData({ x, y, url: urlValue, rect, source: 'cursor', isFormula: false, isNewLink });
        setMode('edit');
        setEditUrl(urlValue);
        setEditText(textValue);
      } catch (error) {
        console.error('Failed to open hyperlink popup:', error);
        addGlobalSnackbar('Failed to open hyperlink editor. Please try again.');
      }
    };

    events.on('insertLink', handleInsertLink);
    return () => {
      events.off('insertLink', handleInsertLink);
    };
  }, [addGlobalSnackbar]);

  // Handle inline hyperlink input (Ctrl+K in inline editor)
  useEffect(() => {
    const handleShowInlineHyperlinkInput = (data: { selectedText: string; existingUrl?: string }) => {
      // Get the inline editor's position to use for the popup
      const location = inlineEditorHandler.location;
      if (!location) return;

      const sheet = sheets.sheet;
      let { x, y } = location;

      // If the inline editor is on a merged cell, use the top-left cell of the merge
      const mergeRect = sheet.getMergeCellRect(x, y);
      if (mergeRect) {
        x = Number(mergeRect.min.x);
        y = Number(mergeRect.min.y);
      }

      const rect = getCellBounds(sheet, x, y);

      // If the selection precisely matches an existing hyperlink, pre-populate URL and text
      // Otherwise, leave URL blank and use the selected text (plain text)
      const urlValue = data.existingUrl ?? '';
      const textValue = data.selectedText;

      // Set mode ref synchronously to prevent inlineEditorCursorOnHyperlink from overwriting values
      // (The useEffect that syncs mode to modeRef runs after state updates, creating a race condition)
      visibilityRef.current.setModeRef('edit');

      setLinkData({
        x,
        y,
        url: urlValue,
        rect,
        source: 'inline',
        isFormula: false,
        hasSelection: !!data.selectedText,
      });
      setMode('edit');
      setEditUrl(urlValue);
      setEditText(textValue);
    };

    events.on('showInlineHyperlinkInput', handleShowInlineHyperlinkInput);
    return () => {
      events.off('showInlineHyperlinkInput', handleShowInlineHyperlinkInput);
    };
  }, []);

  // Handle cursor position on hyperlinks in inline editor (show popup when cursor is on link)
  useEffect(() => {
    const handleInlineEditorCursorOnHyperlink = (
      data?: { url: string; rect: Rectangle; linkText: string } | undefined
    ) => {
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
          linkText: data.linkText,
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
    const handleHoverLink = (link?: {
      x: number;
      y: number;
      url: string;
      rect: Rectangle;
      linkText?: string;
      isNakedUrl?: boolean;
      spanStart?: number;
      spanEnd?: number;
    }) => {
      const v = visibilityRef.current;
      if (v.isEditMode()) return;
      if (v.isJustClosed()) return;
      if (v.isHovering()) return;
      if (inlineEditorHandler.isOpen()) return;

      if (link) {
        // Clear timeouts when hovering a new link
        v.clearTimeouts();

        const current = linkDataRef.current;
        if (current?.x === link.x && current?.y === link.y && current?.url === link.url) return;

        v.setHoverTimeout(async () => {
          const sheet = sheets.sheet;
          const cellRect = getCellBounds(sheet, link.x, link.y);
          const codeCell = await quadraticCore.getCodeCell(sheet.id, link.x, link.y);
          const isFormula = codeCell?.language === 'Formula';

          setLinkData({
            x: link.x,
            y: link.y,
            url: link.url,
            rect: cellRect,
            source: 'hover',
            isFormula,
            linkText: link.linkText,
            isNakedUrl: link.isNakedUrl,
            spanStart: link.spanStart,
            spanEnd: link.spanEnd,
          });
          setMode('view');
          setEditUrl(link.url);
        }, HOVER_DELAY);
      } else {
        // Mouse left link area (hoverLink event with undefined)
        // Always clear hover timeout to prevent popup from showing after mouse left
        v.clearTimeouts();

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
          }, FADE_OUT_DELAY);
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
        }, FADE_OUT_DELAY);
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

  // Hide when inline editor opens or closes (for inline-sourced popups)
  useEffect(() => {
    const handleChangeInput = (input: boolean) => {
      if (input) {
        // Inline editor opened - hide any existing popup
        setLinkData(undefined);
        setMode('view');
      } else {
        // Inline editor closed - hide popup if it was from inline source
        if (linkDataRef.current?.source === 'inline') {
          setLinkData(undefined);
          setMode('view');
        }
      }
    };

    events.on('changeInput', handleChangeInput);
    return () => {
      events.off('changeInput', handleChangeInput);
    };
  }, []);

  // Hide when the cell's hyperlink is deleted
  useEffect(() => {
    const handleHashContentChanged = async (sheetId: string) => {
      const current = linkDataRef.current;
      if (!current) return;
      // Don't interfere with edit mode
      if (visibilityRef.current.isEditMode()) return;
      // Only check cells on the current sheet
      if (sheetId !== sheets.sheet.id) return;

      // Re-check if the cell still has a hyperlink
      const cellValue = await quadraticCore.getCellValue(sheetId, current.x, current.y);

      // Check if cell still has a hyperlink
      const hasHyperlink = cellValue?.kind === 'RichText' && cellValue.spans?.some((span) => span.link);

      if (!hasHyperlink) {
        // Hyperlink was removed or cell was deleted - close popup
        setLinkData(undefined);
        setMode('view');
      }
    };

    events.on('hashContentChanged', handleHashContentChanged);
    return () => {
      events.off('hashContentChanged', handleHashContentChanged);
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

  // Close popup when focus leaves the popup container
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Don't close in edit mode - user is actively editing
      // This prevents the popup from closing when something else steals focus
      // (e.g., focusGrid() being called when a menu closes)
      if (mode === 'edit') {
        return;
      }
      // Check if the new focus target is outside the popup
      const relatedTarget = e.relatedTarget as Node | null;
      if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
        // Focus is still within the popup, don't close
        return;
      }
      closePopup(true);
    },
    [closePopup, mode]
  );

  // Close popup on wheel scroll (user likely wants to zoom/scroll the viewport)
  const handleWheel = useCallback(() => {
    if (visibilityRef.current.isEditMode()) return;
    closePopup(true);
  }, [closePopup]);

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
      closePopup(true);
      // Focus grid after a short delay to ensure the popup is closed
      focusGrid();
    }
  }, [linkData, addGlobalSnackbar, closePopup]);

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

    // Use linkText if available (for partial hyperlinks), otherwise fall back to full cell display
    const displayValue =
      linkData.linkText ?? (await quadraticCore.getDisplayCell(sheets.current, linkData.x, linkData.y));
    setEditText(displayValue && displayValue !== linkData.url ? displayValue : '');
    setEditUrl(linkData.url);
    setMode('edit');
  }, [linkData, closePopup]);

  const handleRemoveLink = useCallback(async () => {
    if (!linkData) return;

    if (linkData.source === 'inline') {
      // Remove hyperlink from inline editor's span tracking
      inlineEditorSpans.removeHyperlinkAtCursor();
      inlineEditorMonaco.focus();
      closePopup(true);
      return;
    }

    // Get the current cell value to access its spans
    const cellValue = await quadraticCore.getCellValue(sheets.current, linkData.x, linkData.y);

    if (cellValue?.kind === 'RichText' && cellValue.spans) {
      // Find the span at the matching character position and remove the link property
      // We use character position (spanStart/spanEnd) to uniquely identify the span
      let charPos = 0;
      const modifiedSpans = cellValue.spans.map((span) => {
        const spanStart = charPos;
        const spanEnd = charPos + span.text.length;
        charPos = spanEnd;

        // Match by character position if available, otherwise fall back to URL + text
        const matches =
          linkData.spanStart !== undefined && linkData.spanEnd !== undefined
            ? spanStart === linkData.spanStart && spanEnd === linkData.spanEnd
            : span.link === linkData.url && span.text === linkData.linkText;

        if (matches) {
          // Set link to null to remove the hyperlink, keep everything else
          // Ensure all required TextSpan fields are present
          return {
            text: span.text,
            link: null,
            bold: span.bold ?? null,
            italic: span.italic ?? null,
            underline: span.underline ?? null,
            strike_through: span.strike_through ?? null,
            text_color: span.text_color ?? null,
            font_size: span.font_size ?? null,
          };
        }
        return span;
      });

      // Save the modified spans back as RichText
      quadraticCore.setCellRichText(sheets.current, linkData.x, linkData.y, modifiedSpans);
    }

    closePopup(true);
    focusGrid();
  }, [linkData, closePopup]);

  const handleSaveEdit = useCallback(async () => {
    if (!linkData || !editUrl.trim()) return;

    const normalizedUrl = ensureHttpProtocol(editUrl);
    const text = editText.trim() || normalizedUrl;
    const hasCustomTitle = text !== normalizedUrl;

    if (linkData.source === 'inline') {
      // Check if we're editing an existing hyperlink or inserting a new one
      if (inlineEditorSpans.hasPendingHyperlink()) {
        // Inserting a new hyperlink (via Ctrl+K)
        // Inherit current formatting from cursor position
        const formatting = inlineEditorHandler.getFormattingStateForHyperlink();
        inlineEditorSpans.completePendingHyperlink(normalizedUrl, text, formatting);
      } else {
        // Editing an existing hyperlink - update in place
        inlineEditorSpans.updateHyperlinkAtCursor(normalizedUrl, text);
      }
      inlineEditorMonaco.focus();
      closePopup(true);
      return;
    }

    if (linkData.isNakedUrl && !hasCustomTitle) {
      // For naked URLs without a custom title, keep as plain text
      quadraticCore.setCellValue(sheets.current, linkData.x, linkData.y, normalizedUrl, false);
    } else if (linkData.isNewLink) {
      // Creating a new link - replace entire cell content with the new hyperlink
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
    } else {
      // Get the current cell value to check if it has multiple spans
      const cellValue = await quadraticCore.getCellValue(sheets.current, linkData.x, linkData.y);

      if (cellValue?.kind === 'RichText' && cellValue.spans && cellValue.spans.length > 1) {
        // Cell has multiple spans - update only the matching hyperlink span
        // We use character position (spanStart/spanEnd) to uniquely identify the span
        let charPos = 0;
        const modifiedSpans = cellValue.spans.map((span) => {
          const spanStart = charPos;
          const spanEnd = charPos + span.text.length;
          charPos = spanEnd;

          // Match by character position if available, otherwise fall back to URL + text
          const matches =
            linkData.spanStart !== undefined && linkData.spanEnd !== undefined
              ? spanStart === linkData.spanStart && spanEnd === linkData.spanEnd
              : span.link === linkData.url && span.text === linkData.linkText;

          if (matches) {
            // Update this span's text and link
            return {
              text,
              link: normalizedUrl,
              bold: span.bold ?? null,
              italic: span.italic ?? null,
              underline: span.underline ?? null,
              strike_through: span.strike_through ?? null,
              text_color: span.text_color ?? null,
              font_size: span.font_size ?? null,
            };
          }
          return span;
        });
        quadraticCore.setCellRichText(sheets.current, linkData.x, linkData.y, modifiedSpans);
      } else {
        // Single span or simple case - replace the entire cell
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
    }
    closePopup(true);
    focusGrid();
  }, [linkData, editUrl, editText, closePopup]);

  const handleCancelEdit = useCallback(() => {
    if (linkData?.source === 'inline') {
      inlineEditorSpans.cancelPendingHyperlink();
      inlineEditorMonaco.focus();
    } else {
      focusGrid();
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

  // Click-outside detection
  const popupRef = useRef<HTMLDivElement | null>(null);
  const setPopupRef = useCallback((node: HTMLDivElement | null) => {
    popupRef.current = node;
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only handle click-outside in edit mode (check via ref to avoid re-running effect)
      if (modeRef.current !== 'edit' || !popupRef.current) return;

      // Check if click was outside the popup
      if (!popupRef.current.contains(e.target as Node)) {
        // Cancel edit: handle inline source cleanup, then close popup
        if (linkDataRef.current?.source === 'inline') {
          inlineEditorSpans.cancelPendingHyperlink();
          inlineEditorMonaco.focus();
        } else {
          focusGrid();
        }
        closePopup(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [closePopup]); // closePopup has no dependencies, uses refs internally

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
    setPopupRef,
    setEditUrl,
    setEditText,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
    handleBlur,
    handleWheel,
    handleOpenLink,
    handleCopyLink,
    handleEditMode,
    handleRemoveLink,
    handleSaveEdit,
    handleCancelEdit,
    handleKeyDown,
    handleKeyUp,
    closePopup,
  };
}
