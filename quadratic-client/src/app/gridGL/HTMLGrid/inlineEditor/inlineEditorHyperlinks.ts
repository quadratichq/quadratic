//! Manages hyperlink decorations and span tracking for the inline editor.
//! When editing a RichText cell, this module tracks span positions and
//! displays hyperlinks with proper styling (blue + underlined).

import { events } from '@/app/events/events';
import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import type { TextSpan } from '@/app/quadratic-core-types';
import * as monaco from 'monaco-editor';

// CSS class for hyperlink styling - injected into DOM
const HYPERLINK_STYLE_ID = 'inline-editor-hyperlink-styles';
const HYPERLINK_CLASS = 'inline-hyperlink';

// Regex to match URLs (http:// or https://)
const URL_REGEX = /^https?:\/\/[^\s<>"']+$/i;

interface TrackedSpan {
  start: number;
  end: number;
  link?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  textColor?: string;
}

interface PendingHyperlink {
  startOffset: number;
  endOffset: number;
  selectedText: string;
}

class InlineEditorHyperlinks {
  private decorations: monaco.editor.IEditorDecorationsCollection | null = null;
  private spans: TrackedSpan[] = [];
  private active = false;

  // Pending hyperlink being edited (from Ctrl+K in inline editor)
  private pendingHyperlink: PendingHyperlink | null = null;

  constructor() {
    this.injectStyles();
    inlineEditorEvents.on('contentChanged', this.handleContentChanged);
    events.on('insertLinkInline', this.handleInsertLinkInline);
  }

  private handleContentChanged = (changes: monaco.editor.IModelContentChange[]) => {
    this.onContentChange(changes);
    this.checkAutoLinkOnSpace(changes);
  };

  private handleInsertLinkInline = (data: {
    selectedText: string;
    selectionRange?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
  }) => {
    if (data.selectionRange) {
      const offsets = this.rangeToOffsets(data.selectionRange);
      if (offsets) {
        this.pendingHyperlink = {
          startOffset: offsets.start,
          endOffset: offsets.end,
          selectedText: data.selectedText,
        };
        // Emit event for UI to show hyperlink input
        events.emit('showInlineHyperlinkInput', {
          selectedText: data.selectedText,
        });
      }
    } else {
      // No selection - insert at cursor position
      const position = inlineEditorMonaco.getPosition();
      const offset = this.positionToOffset(position);
      if (offset !== null) {
        this.pendingHyperlink = {
          startOffset: offset,
          endOffset: offset,
          selectedText: '',
        };
        events.emit('showInlineHyperlinkInput', {
          selectedText: '',
        });
      }
    }
  };

  /**
   * Complete the pending hyperlink insertion with the given URL.
   * If there was a selection, create a hyperlink for that range.
   * If no selection, insert the URL as both text and link.
   */
  completePendingHyperlink(url: string, displayText?: string) {
    if (!this.pendingHyperlink) return;

    const { startOffset, endOffset } = this.pendingHyperlink;

    if (startOffset === endOffset) {
      // No selection - insert the URL/displayText as new text with hyperlink
      const textToInsert = displayText || url;
      const position = this.offsetToPosition(startOffset);
      if (position) {
        inlineEditorMonaco.insertTextAtPosition(position, textToInsert);
        // After insertion, create the hyperlink span
        this.addHyperlinkSpan(startOffset, startOffset + textToInsert.length, url);
      }
    } else {
      // There was a selection - create hyperlink for the selected range
      this.addHyperlinkSpan(startOffset, endOffset, url);
    }

    this.pendingHyperlink = null;
  }

  /**
   * Cancel the pending hyperlink insertion.
   */
  cancelPendingHyperlink() {
    this.pendingHyperlink = null;
  }

  /**
   * Check if there's a pending hyperlink.
   */
  hasPendingHyperlink(): boolean {
    return this.pendingHyperlink !== null;
  }

  /**
   * Get the pending hyperlink info.
   */
  getPendingHyperlink(): PendingHyperlink | null {
    return this.pendingHyperlink;
  }

  private injectStyles() {
    if (document.getElementById(HYPERLINK_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = HYPERLINK_STYLE_ID;
    style.textContent = `
      .${HYPERLINK_CLASS} {
        color: #0066cc !important;
        text-decoration: underline !important;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Initialize hyperlink tracking for a RichText cell.
   * Converts TextSpan array to tracked spans with character positions.
   */
  setSpans(textSpans: TextSpan[]) {
    this.active = true;
    this.spans = [];

    let position = 0;
    for (const span of textSpans) {
      const start = position;
      const end = position + span.text.length;
      position = end;

      this.spans.push({
        start,
        end,
        link: span.link ?? undefined,
        bold: span.bold ?? undefined,
        italic: span.italic ?? undefined,
        underline: span.underline ?? undefined,
        strikeThrough: span.strike_through ?? undefined,
        textColor: span.text_color ?? undefined,
      });
    }

    this.updateDecorations();
  }

  /**
   * Get the current tracked spans.
   */
  getSpans(): TrackedSpan[] {
    return this.spans;
  }

  /**
   * Check if hyperlink tracking is active.
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Clear all hyperlink tracking state.
   */
  clear() {
    this.active = false;
    this.spans = [];
    this.decorations?.clear();
    this.decorations = null;
  }

  /**
   * Update Monaco decorations to match current span positions.
   */
  private updateDecorations() {
    if (!this.active) return;

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    for (const span of this.spans) {
      if (!span.link) continue;

      const startPos = this.offsetToPosition(span.start);
      const endPos = this.offsetToPosition(span.end);

      if (!startPos || !endPos) continue;

      newDecorations.push({
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        options: {
          inlineClassName: HYPERLINK_CLASS,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          hoverMessage: { value: span.link },
        },
      });
    }

    if (this.decorations) {
      this.decorations.set(newDecorations);
    } else {
      this.decorations = inlineEditorMonaco.createDecorationsCollection(newDecorations);
    }
  }

  /**
   * Convert a character offset to a Monaco position.
   */
  private offsetToPosition(offset: number): monaco.Position | null {
    const editor = inlineEditorMonaco.editor;
    if (!editor) return null;

    const model = editor.getModel();
    if (!model) return null;

    return model.getPositionAt(offset);
  }

  /**
   * Convert a Monaco position to a character offset.
   */
  private positionToOffset(position: monaco.Position): number | null {
    const editor = inlineEditorMonaco.editor;
    if (!editor) return null;

    const model = editor.getModel();
    if (!model) return null;

    return model.getOffsetAt(position);
  }

  /**
   * Handle content changes from Monaco.
   * Adjusts span positions based on insertions and deletions.
   */
  onContentChange(changes: monaco.editor.IModelContentChange[]) {
    if (!this.active || this.spans.length === 0) return;

    // Sort changes in reverse order to process from end to start
    const sortedChanges = [...changes].sort((a, b) => b.rangeOffset - a.rangeOffset);

    for (const change of sortedChanges) {
      const changeStart = change.rangeOffset;
      const changeEnd = changeStart + change.rangeLength;
      const delta = change.text.length - change.rangeLength;

      this.spans = this.spans
        .map((span) => {
          // Span is entirely before the change - no adjustment needed
          if (span.end <= changeStart) {
            return span;
          }

          // Span is entirely after the change - shift by delta
          if (span.start >= changeEnd) {
            return {
              ...span,
              start: span.start + delta,
              end: span.end + delta,
            };
          }

          // Change is entirely within the span - adjust end
          if (changeStart >= span.start && changeEnd <= span.end) {
            return {
              ...span,
              end: span.end + delta,
            };
          }

          // Change overlaps span start
          if (changeStart < span.start && changeEnd > span.start && changeEnd <= span.end) {
            return {
              ...span,
              start: changeStart + change.text.length,
              end: span.end + delta,
            };
          }

          // Change overlaps span end
          if (changeStart >= span.start && changeStart < span.end && changeEnd > span.end) {
            return {
              ...span,
              end: changeStart,
            };
          }

          // Change encompasses entire span - remove it
          if (changeStart <= span.start && changeEnd >= span.end) {
            return null;
          }

          return span;
        })
        .filter((span): span is TrackedSpan => span !== null && span.end > span.start);
    }

    this.updateDecorations();
  }

  /**
   * Check if a space was typed after a URL and auto-convert it to a hyperlink.
   */
  private checkAutoLinkOnSpace(changes: monaco.editor.IModelContentChange[]) {
    // Only check if a single space or newline was typed
    for (const change of changes) {
      if (change.text !== ' ' && change.text !== '\n') continue;
      if (change.rangeLength !== 0) continue; // Skip if replacing text

      const spaceOffset = change.rangeOffset;

      // Get the full text from the editor
      const editor = inlineEditorMonaco.editor;
      if (!editor) continue;

      const model = editor.getModel();
      if (!model) continue;

      const fullText = model.getValue();

      // Find the start of the word before the space
      // Look backwards from spaceOffset to find word boundary
      let wordStart = spaceOffset;
      while (wordStart > 0 && !/\s/.test(fullText[wordStart - 1])) {
        wordStart--;
      }

      const word = fullText.slice(wordStart, spaceOffset);

      // Check if the word is a URL
      if (URL_REGEX.test(word)) {
        // Check if this range is already a hyperlink
        const existingSpan = this.spans.find((span) => span.link && span.start <= wordStart && span.end >= spaceOffset);
        if (existingSpan) continue;

        // Add the hyperlink span
        this.addHyperlinkSpan(wordStart, spaceOffset, word);
      }
    }
  }

  /**
   * Get the hyperlink span at a given cursor position, if any.
   */
  getHyperlinkAtPosition(position: monaco.Position): TrackedSpan | null {
    if (!this.active) return null;

    const offset = this.positionToOffset(position);
    if (offset === null) return null;

    for (const span of this.spans) {
      if (span.link && offset >= span.start && offset < span.end) {
        return span;
      }
    }

    return null;
  }

  /**
   * Add or update a hyperlink span for a given character range.
   * If the range overlaps existing spans, they will be split accordingly.
   */
  addHyperlinkSpan(startOffset: number, endOffset: number, url: string) {
    if (!this.active) {
      // Activate hyperlink tracking if not already active
      this.active = true;
    }

    // Remove or split any spans that overlap with the new hyperlink range
    const newSpans: TrackedSpan[] = [];
    for (const span of this.spans) {
      if (span.end <= startOffset || span.start >= endOffset) {
        // Span is entirely outside the new range - keep it
        newSpans.push(span);
      } else if (span.start >= startOffset && span.end <= endOffset) {
        // Span is entirely inside the new range - remove it (will be replaced)
        continue;
      } else if (span.start < startOffset && span.end > endOffset) {
        // Span encompasses the new range - split into two
        newSpans.push({ ...span, end: startOffset });
        newSpans.push({ ...span, start: endOffset });
      } else if (span.start < startOffset && span.end > startOffset) {
        // Span overlaps start - truncate it
        newSpans.push({ ...span, end: startOffset });
      } else if (span.start < endOffset && span.end > endOffset) {
        // Span overlaps end - shift start
        newSpans.push({ ...span, start: endOffset });
      }
    }

    // Add the new hyperlink span
    newSpans.push({
      start: startOffset,
      end: endOffset,
      link: url,
    });

    // Sort spans by start position
    this.spans = newSpans.sort((a, b) => a.start - b.start);
    this.updateDecorations();
  }

  /**
   * Convert a Monaco range to character offsets.
   */
  rangeToOffsets(range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }): {
    start: number;
    end: number;
  } | null {
    const editor = inlineEditorMonaco.editor;
    if (!editor) return null;

    const model = editor.getModel();
    if (!model) return null;

    const start = model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
    const end = model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });

    return { start, end };
  }

  /**
   * Create a TextSpan with all required fields, using null for unset values.
   */
  private createTextSpan(
    text: string,
    options?: {
      link?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikeThrough?: boolean;
      textColor?: string;
    }
  ): TextSpan {
    return {
      text,
      link: options?.link ?? null,
      bold: options?.bold ?? null,
      italic: options?.italic ?? null,
      underline: options?.underline ?? null,
      strike_through: options?.strikeThrough ?? null,
      text_color: options?.textColor ?? null,
      font_size: null,
    };
  }

  /**
   * Build TextSpan array from current text and tracked spans.
   * Used when saving the cell.
   * @param text The text to build spans for (typically trimmed)
   * @param trimOffset Offset to subtract from span positions (for leading whitespace that was trimmed)
   */
  buildTextSpans(text: string, trimOffset: number = 0): TextSpan[] {
    if (!this.active || this.spans.length === 0) {
      // Return single plain text span if no spans tracked
      return [this.createTextSpan(text)];
    }

    const result: TextSpan[] = [];
    let lastEnd = 0;

    // Sort spans by start position and adjust for trim offset
    const sortedSpans = [...this.spans]
      .map((span) => ({
        ...span,
        start: Math.max(0, span.start - trimOffset),
        end: Math.max(0, span.end - trimOffset),
      }))
      .filter((span) => span.end > span.start && span.start < text.length)
      .sort((a, b) => a.start - b.start);

    for (const span of sortedSpans) {
      // Clamp span end to text length
      const clampedEnd = Math.min(span.end, text.length);

      // Add gap text as plain span
      if (span.start > lastEnd) {
        const gapText = text.slice(lastEnd, span.start);
        if (gapText) {
          result.push(this.createTextSpan(gapText));
        }
      }

      // Add the formatted span
      const spanText = text.slice(span.start, clampedEnd);
      if (spanText) {
        result.push(
          this.createTextSpan(spanText, {
            link: span.link,
            bold: span.bold,
            italic: span.italic,
            underline: span.underline,
            strikeThrough: span.strikeThrough,
            textColor: span.textColor,
          })
        );
      }

      lastEnd = clampedEnd;
    }

    // Add remaining text as plain span
    if (lastEnd < text.length) {
      const remainingText = text.slice(lastEnd);
      if (remainingText) {
        result.push(this.createTextSpan(remainingText));
      }
    }

    return result;
  }

  /**
   * Check if there are any formatted spans (requiring RichText).
   */
  hasFormattedSpans(): boolean {
    return this.spans.some(
      (span) => span.link || span.bold || span.italic || span.underline || span.strikeThrough || span.textColor
    );
  }
}

export const inlineEditorHyperlinks = new InlineEditorHyperlinks();
