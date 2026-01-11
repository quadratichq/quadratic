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
const BOLD_CLASS = 'inline-bold';
const NOT_BOLD_CLASS = 'inline-not-bold';
const ITALIC_CLASS = 'inline-italic';
const NOT_ITALIC_CLASS = 'inline-not-italic';
const UNDERLINE_CLASS = 'inline-underline';
const STRIKE_THROUGH_CLASS = 'inline-strike-through';

// Regex to match URLs (http:// or https://)
const URL_REGEX = /^https?:\/\/[^\s<>"']+$/i;

export interface SpanFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  textColor?: string;
}

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

class InlineEditorSpans {
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
    // Note: We need compound selectors to properly combine span-level text-decoration
    // with cell-level text-decoration. CSS text-decoration values don't inherit/combine,
    // so we must explicitly specify all decorations in each rule.
    style.textContent = `
      .${HYPERLINK_CLASS} {
        color: #0066cc !important;
        text-decoration: underline !important;
        cursor: pointer;
        vertical-align: baseline !important;
        line-height: inherit !important;
      }
      /* Hyperlink with cell-level strike-through: combine both */
      [data-strike-through='true'] .${HYPERLINK_CLASS}:not(.${STRIKE_THROUGH_CLASS}) {
        text-decoration: underline line-through !important;
      }
      .${BOLD_CLASS} {
        font-weight: bold !important;
        vertical-align: baseline !important;
        line-height: inherit !important;
      }
      /* Override cell-level bold when span explicitly sets not-bold */
      .${NOT_BOLD_CLASS} {
        font-weight: normal !important;
        vertical-align: baseline !important;
        line-height: inherit !important;
      }
      .${ITALIC_CLASS} {
        font-style: italic !important;
        vertical-align: baseline !important;
        line-height: inherit !important;
      }
      /* Override cell-level italic when span explicitly sets not-italic */
      .${NOT_ITALIC_CLASS} {
        font-style: normal !important;
        vertical-align: baseline !important;
        line-height: inherit !important;
      }
      .${UNDERLINE_CLASS} {
        text-decoration: underline !important;
        vertical-align: baseline !important;
        line-height: inherit !important;
      }
      /* Span underline with cell-level strike-through: combine both */
      [data-strike-through='true'] .${UNDERLINE_CLASS}:not(.${STRIKE_THROUGH_CLASS}) {
        text-decoration: underline line-through !important;
      }
      .${STRIKE_THROUGH_CLASS} {
        text-decoration: line-through !important;
        vertical-align: baseline !important;
        line-height: inherit !important;
      }
      /* Span strike-through with cell-level underline: combine both */
      [data-underline='true'] .${STRIKE_THROUGH_CLASS}:not(.${UNDERLINE_CLASS}) {
        text-decoration: underline line-through !important;
      }
      /* Both span underline and strike-through */
      .${UNDERLINE_CLASS}.${STRIKE_THROUGH_CLASS} {
        text-decoration: underline line-through !important;
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
    this.cleanupDynamicColorStyles();
  }

  /**
   * Update Monaco decorations to match current span positions.
   */
  private updateDecorations() {
    if (!this.active) return;

    // Clean up old dynamic styles before creating new ones
    this.cleanupDynamicColorStyles();

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    for (const span of this.spans) {
      // Check if span has any formatting that needs decoration
      // Note: We need to distinguish between `false` (explicitly not set) and `undefined` (inherit)
      // - `span.bold === true` → apply bold
      // - `span.bold === false` → apply not-bold (to override cell-level bold)
      // - `span.bold === undefined` → inherit from cell (no decoration needed)
      const hasBoldOverride = span.bold !== undefined;
      const hasItalicOverride = span.italic !== undefined;
      const hasFormatting =
        span.link || hasBoldOverride || hasItalicOverride || span.underline || span.strikeThrough || span.textColor;

      if (!hasFormatting) {
        continue;
      }

      const startPos = this.offsetToPosition(span.start);
      const endPos = this.offsetToPosition(span.end);

      if (!startPos || !endPos) continue;

      // Build the class name based on formatting
      const classes: string[] = [];
      if (span.link) classes.push(HYPERLINK_CLASS);

      // Bold: true = bold, false = explicitly not-bold (override cell-level)
      if (span.bold === true) {
        classes.push(BOLD_CLASS);
      } else if (span.bold === false) {
        classes.push(NOT_BOLD_CLASS);
      }

      // Italic: true = italic, false = explicitly not-italic (override cell-level)
      if (span.italic === true) {
        classes.push(ITALIC_CLASS);
      } else if (span.italic === false) {
        classes.push(NOT_ITALIC_CLASS);
      }

      if (span.underline) classes.push(UNDERLINE_CLASS);
      if (span.strikeThrough) classes.push(STRIKE_THROUGH_CLASS);

      // For text color, create a unique class and inject a dynamic style
      if (span.textColor) {
        const colorClass = this.getOrCreateColorClass(span.textColor);
        classes.push(colorClass);
      }

      newDecorations.push({
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        options: {
          inlineClassName: classes.length > 0 ? classes.join(' ') : undefined,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          hoverMessage: span.link ? { value: span.link } : undefined,
        },
      });
    }

    if (this.decorations) {
      this.decorations.set(newDecorations);
    } else {
      this.decorations = inlineEditorMonaco.createDecorationsCollection(newDecorations);
    }
  }

  // Map of color values to their CSS class names
  private colorClassMap: Map<string, string> = new Map();
  private colorClassCounter = 0;

  /**
   * Get or create a CSS class for a specific color.
   */
  private getOrCreateColorClass(color: string): string {
    const existing = this.colorClassMap.get(color);
    if (existing) return existing;

    // Create a new class for this color
    const className = `inline-text-color-${this.colorClassCounter++}`;
    this.colorClassMap.set(color, className);

    // Inject the style
    const styleId = `inline-color-style-${className}`;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `.${className} { color: ${color} !important; }`;
    document.head.appendChild(style);

    return className;
  }

  /**
   * Clean up dynamic color styles.
   */
  private cleanupDynamicColorStyles() {
    for (const className of this.colorClassMap.values()) {
      const styleId = `inline-color-style-${className}`;
      const style = document.getElementById(styleId);
      if (style) style.remove();
    }
    this.colorClassMap.clear();
    this.colorClassCounter = 0;
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
        // Don't auto-link if the entire cell content is just a URL (naked URL)
        // This keeps it as plain text so it's detected as a naked URL instead of RichText
        const textWithoutTrailingSpace = fullText.slice(0, -1); // Remove the trailing space we just typed
        if (URL_REGEX.test(textWithoutTrailingSpace.trim())) continue;

        // Check if this range is already a hyperlink
        const existingSpan = this.spans.find((span) => span.link && span.start <= wordStart && span.end >= spaceOffset);
        if (existingSpan) continue;

        // Add the hyperlink span
        this.addHyperlinkSpan(wordStart, spaceOffset, word);
      }
    }
  }

  /**
   * Check for URLs at the cursor position and auto-convert them to hyperlinks.
   * Called when the editor is about to close (e.g., pressing Enter).
   */
  checkAutoLinkOnClose() {
    const editor = inlineEditorMonaco.editor;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const fullText = model.getValue();
    if (!fullText) return;

    // Don't auto-link if the entire cell content is just a URL (naked URL)
    // This keeps it as plain text so it's detected as a naked URL instead of RichText
    if (URL_REGEX.test(fullText.trim())) return;

    // Get the cursor position offset
    const position = inlineEditorMonaco.getPosition();
    const cursorOffset = this.positionToOffset(position);
    if (cursorOffset === null) return;

    // Find the start of the word at/before the cursor
    // Look backwards from cursorOffset to find word boundary
    let wordStart = cursorOffset;
    while (wordStart > 0 && !/\s/.test(fullText[wordStart - 1])) {
      wordStart--;
    }

    // Find the end of the word at/after the cursor
    let wordEnd = cursorOffset;
    while (wordEnd < fullText.length && !/\s/.test(fullText[wordEnd])) {
      wordEnd++;
    }

    const word = fullText.slice(wordStart, wordEnd);

    if (URL_REGEX.test(word)) {
      // Check if this range is already a hyperlink
      const existingSpan = this.spans.find((span) => span.link && span.start <= wordStart && span.end >= wordEnd);
      if (existingSpan) return;

      // Add the hyperlink span
      this.addHyperlinkSpan(wordStart, wordEnd, word);
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
   * Remove the hyperlink from a span at the current cursor position.
   * Returns true if a hyperlink was removed, false otherwise.
   */
  removeHyperlinkAtCursor(): boolean {
    if (!this.active) return false;

    const position = inlineEditorMonaco.getPosition();
    const offset = this.positionToOffset(position);
    if (offset === null) return false;

    // Find the span with a hyperlink at the current position
    for (let i = 0; i < this.spans.length; i++) {
      const span = this.spans[i];
      if (span.link && offset >= span.start && offset <= span.end) {
        // Remove the link property from the span
        const { link: _link, ...rest } = span;
        // Check if the span has any other formatting
        const hasOtherFormatting = rest.bold || rest.italic || rest.underline || rest.strikeThrough || rest.textColor;
        if (hasOtherFormatting) {
          // Keep the span but without the link
          this.spans[i] = rest as TrackedSpan;
        } else {
          // Remove the span entirely since it has no formatting
          this.spans.splice(i, 1);
        }
        this.updateDecorations();
        return true;
      }
    }

    return false;
  }

  /**
   * Update the hyperlink at the current cursor position with a new URL and optionally new text.
   * Returns true if a hyperlink was updated, false otherwise.
   */
  updateHyperlinkAtCursor(newUrl: string, newText?: string): boolean {
    if (!this.active) return false;

    const position = inlineEditorMonaco.getPosition();
    const offset = this.positionToOffset(position);
    if (offset === null) return false;

    // Find the span with a hyperlink at the current position
    for (let i = 0; i < this.spans.length; i++) {
      const span = this.spans[i];
      if (span.link && offset >= span.start && offset <= span.end) {
        const editor = inlineEditorMonaco.editor;
        const model = editor?.getModel();
        if (!editor || !model) return false;

        const currentText = model.getValue().slice(span.start, span.end);

        // If new text is provided and different from current, replace in editor
        if (newText !== undefined && newText !== currentText) {
          const startPos = this.offsetToPosition(span.start);
          const endPos = this.offsetToPosition(span.end);
          if (startPos && endPos) {
            const range = new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);

            // Calculate the new end position based on text length difference
            const lengthDiff = newText.length - currentText.length;

            // Replace the text
            editor.executeEdits('updateHyperlink', [
              {
                range,
                text: newText,
                forceMoveMarkers: true,
              },
            ]);

            // Update the span with new URL and adjusted end position
            this.spans[i] = {
              ...span,
              link: newUrl,
              end: span.end + lengthDiff,
            };

            // Adjust subsequent spans
            for (let j = i + 1; j < this.spans.length; j++) {
              this.spans[j].start += lengthDiff;
              this.spans[j].end += lengthDiff;
            }
          }
        } else {
          // Just update the URL
          this.spans[i] = {
            ...span,
            link: newUrl,
          };
        }

        this.updateDecorations();
        return true;
      }
    }

    return false;
  }

  /**
   * Apply formatting to the current selection.
   * Returns true if formatting was applied to a selection, false otherwise.
   */
  applyFormattingToSelection(formatting: SpanFormatting): boolean {
    const selection = inlineEditorMonaco.getSelection();
    if (!selection) {
      return false;
    }

    const offsets = this.rangeToOffsets(selection.range);
    if (!offsets || offsets.start === offsets.end) {
      return false;
    }

    this.addFormattingSpan(offsets.start, offsets.end, formatting);
    return true;
  }

  /**
   * Toggle a specific formatting property for the current selection.
   * Returns true if formatting was toggled for a selection, false otherwise.
   */
  toggleFormattingForSelection(property: keyof SpanFormatting): boolean {
    const selection = inlineEditorMonaco.getSelection();
    if (!selection) {
      return false;
    }

    const offsets = this.rangeToOffsets(selection.range);
    if (!offsets || offsets.start === offsets.end) {
      return false;
    }

    // Check if the selection already has this formatting
    const currentValue = this.getFormattingForRange(offsets.start, offsets.end, property);

    // Toggle the formatting
    const newValue = !currentValue;
    this.addFormattingSpan(offsets.start, offsets.end, { [property]: newValue });
    return true;
  }

  /**
   * Check if a range has a specific formatting property set.
   * Returns true if any part of the range has the formatting.
   */
  getFormattingForRange(startOffset: number, endOffset: number, property: keyof SpanFormatting): boolean {
    for (const span of this.spans) {
      // Check if span overlaps with the range
      if (span.end > startOffset && span.start < endOffset) {
        if (span[property]) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if the entire range has a specific formatting property set.
   * Returns true only if every character in the range has the formatting.
   */
  isEntireRangeFormatted(startOffset: number, endOffset: number, property: keyof SpanFormatting): boolean {
    if (startOffset >= endOffset) return false;

    // Build a coverage map to check if every position in the range is formatted
    let pos = startOffset;
    while (pos < endOffset) {
      let foundFormatted = false;
      for (const span of this.spans) {
        // Check if this span covers the current position and has the formatting
        if (span.start <= pos && span.end > pos && span[property]) {
          foundFormatted = true;
          // Advance to the end of this span or the end of the range
          pos = Math.min(span.end, endOffset);
          break;
        }
      }
      if (!foundFormatted) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get formatting summary for the current selection.
   * Returns an object with boolean values indicating if the ENTIRE selection has each formatting.
   * Returns undefined if there's no selection or the inline editor is not active.
   */
  getSelectionFormattingSummary(): SpanFormatting | undefined {
    const selection = inlineEditorMonaco.getSelection();
    if (!selection) {
      return undefined;
    }

    const offsets = this.rangeToOffsets(selection.range);
    if (!offsets || offsets.start === offsets.end) {
      return undefined;
    }

    return {
      bold: this.isEntireRangeFormatted(offsets.start, offsets.end, 'bold'),
      italic: this.isEntireRangeFormatted(offsets.start, offsets.end, 'italic'),
      underline: this.isEntireRangeFormatted(offsets.start, offsets.end, 'underline'),
      strikeThrough: this.isEntireRangeFormatted(offsets.start, offsets.end, 'strikeThrough'),
      textColor: this.getTextColorForRange(offsets.start, offsets.end),
    };
  }

  /**
   * Get formatting at the current cursor position.
   * Returns the formatting of the span the cursor is inside, or undefined if no span.
   */
  getFormattingAtCursor(): SpanFormatting | undefined {
    if (!this.active) return undefined;

    const position = inlineEditorMonaco.getPosition();
    const offset = this.positionToOffset(position);
    if (offset === null) return undefined;

    // Find the span that contains the cursor position
    for (const span of this.spans) {
      if (offset >= span.start && offset < span.end) {
        return {
          bold: span.bold ?? false,
          italic: span.italic ?? false,
          underline: span.underline ?? false,
          strikeThrough: span.strikeThrough ?? false,
          textColor: span.textColor,
        };
      }
    }

    // Also check if cursor is at the end of a span (e.g., right after typing)
    // This allows formatting to "stick" when cursor is at span boundary
    for (const span of this.spans) {
      if (offset === span.end) {
        return {
          bold: span.bold ?? false,
          italic: span.italic ?? false,
          underline: span.underline ?? false,
          strikeThrough: span.strikeThrough ?? false,
          textColor: span.textColor,
        };
      }
    }

    return undefined;
  }

  /**
   * Get the text color for a range if the entire range has the same color.
   * Returns undefined if the range has no color or mixed colors.
   */
  private getTextColorForRange(startOffset: number, endOffset: number): string | undefined {
    if (startOffset >= endOffset) return undefined;

    let commonColor: string | undefined | null = null; // null means we haven't found any color yet

    let pos = startOffset;
    while (pos < endOffset) {
      let foundSpan = false;
      for (const span of this.spans) {
        if (span.start <= pos && span.end > pos) {
          foundSpan = true;
          const spanColor = span.textColor;

          if (commonColor === null) {
            commonColor = spanColor;
          } else if (commonColor !== spanColor) {
            // Mixed colors - return undefined
            return undefined;
          }

          pos = Math.min(span.end, endOffset);
          break;
        }
      }
      if (!foundSpan) {
        // Gap in spans - treat as no color
        if (commonColor === null) {
          commonColor = undefined;
        } else if (commonColor !== undefined) {
          return undefined; // Mixed: some have color, gap has none
        }
        pos++;
      }
    }

    return commonColor === null ? undefined : commonColor;
  }

  /**
   * Add or update a formatting span for a given character range.
   * Merges formatting with existing spans in the range.
   */
  addFormattingSpan(startOffset: number, endOffset: number, formatting: SpanFormatting) {
    if (!this.active) {
      // Activate tracking if not already active
      this.active = true;
    }

    // Process spans that overlap with the new range
    const newSpans: TrackedSpan[] = [];

    for (const span of this.spans) {
      if (span.end <= startOffset || span.start >= endOffset) {
        // Span is entirely outside the new range - keep it
        newSpans.push(span);
      } else if (span.start >= startOffset && span.end <= endOffset) {
        // Span is entirely inside the new range - merge formatting
        newSpans.push({
          ...span,
          bold: formatting.bold !== undefined ? formatting.bold : span.bold,
          italic: formatting.italic !== undefined ? formatting.italic : span.italic,
          underline: formatting.underline !== undefined ? formatting.underline : span.underline,
          strikeThrough: formatting.strikeThrough !== undefined ? formatting.strikeThrough : span.strikeThrough,
          textColor: formatting.textColor !== undefined ? formatting.textColor : span.textColor,
        });
      } else if (span.start < startOffset && span.end > endOffset) {
        // Span encompasses the new range - split into three
        newSpans.push({ ...span, end: startOffset });
        newSpans.push({
          ...span,
          start: startOffset,
          end: endOffset,
          bold: formatting.bold !== undefined ? formatting.bold : span.bold,
          italic: formatting.italic !== undefined ? formatting.italic : span.italic,
          underline: formatting.underline !== undefined ? formatting.underline : span.underline,
          strikeThrough: formatting.strikeThrough !== undefined ? formatting.strikeThrough : span.strikeThrough,
          textColor: formatting.textColor !== undefined ? formatting.textColor : span.textColor,
        });
        newSpans.push({ ...span, start: endOffset });
      } else if (span.start < startOffset && span.end > startOffset) {
        // Span overlaps start - split into two
        newSpans.push({ ...span, end: startOffset });
        newSpans.push({
          ...span,
          start: startOffset,
          bold: formatting.bold !== undefined ? formatting.bold : span.bold,
          italic: formatting.italic !== undefined ? formatting.italic : span.italic,
          underline: formatting.underline !== undefined ? formatting.underline : span.underline,
          strikeThrough: formatting.strikeThrough !== undefined ? formatting.strikeThrough : span.strikeThrough,
          textColor: formatting.textColor !== undefined ? formatting.textColor : span.textColor,
        });
      } else if (span.start < endOffset && span.end > endOffset) {
        // Span overlaps end - split into two
        newSpans.push({
          ...span,
          end: endOffset,
          bold: formatting.bold !== undefined ? formatting.bold : span.bold,
          italic: formatting.italic !== undefined ? formatting.italic : span.italic,
          underline: formatting.underline !== undefined ? formatting.underline : span.underline,
          strikeThrough: formatting.strikeThrough !== undefined ? formatting.strikeThrough : span.strikeThrough,
          textColor: formatting.textColor !== undefined ? formatting.textColor : span.textColor,
        });
        newSpans.push({ ...span, start: endOffset });
      }
    }

    // Check if we covered the entire range with existing spans
    // If not, add a new span for the uncovered portion
    const coveredRanges = newSpans
      .filter((s) => s.start >= startOffset && s.end <= endOffset)
      .sort((a, b) => a.start - b.start);

    let lastEnd = startOffset;
    for (const covered of coveredRanges) {
      if (covered.start > lastEnd) {
        // Gap before this span - add a new formatting span
        newSpans.push({
          start: lastEnd,
          end: covered.start,
          ...formatting,
        });
      }
      lastEnd = Math.max(lastEnd, covered.end);
    }

    // Add span for any remaining gap
    if (lastEnd < endOffset) {
      newSpans.push({
        start: lastEnd,
        end: endOffset,
        ...formatting,
      });
    }

    // Sort spans by start position and filter out empty spans
    this.spans = newSpans.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);

    // Merge adjacent spans with identical formatting
    this.mergeAdjacentSpans();

    this.updateDecorations();
  }

  /**
   * Merge adjacent spans that have identical formatting.
   */
  private mergeAdjacentSpans() {
    if (this.spans.length < 2) return;

    const merged: TrackedSpan[] = [];
    let current = this.spans[0];

    for (let i = 1; i < this.spans.length; i++) {
      const next = this.spans[i];

      // Check if spans are adjacent and have identical formatting
      if (
        current.end === next.start &&
        current.link === next.link &&
        current.bold === next.bold &&
        current.italic === next.italic &&
        current.underline === next.underline &&
        current.strikeThrough === next.strikeThrough &&
        current.textColor === next.textColor
      ) {
        // Merge the spans
        current = { ...current, end: next.end };
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    this.spans = merged;
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

  /**
   * Clear all formatting from all spans, converting the cell to plain text.
   * This removes all tracked spans so the cell will be saved as regular text.
   */
  clearAllFormatting(): void {
    this.spans = [];
    this.decorations?.clear();
    this.cleanupDynamicColorStyles();
    this.updateDecorations();
  }
}

export const inlineEditorSpans = new InlineEditorSpans();
