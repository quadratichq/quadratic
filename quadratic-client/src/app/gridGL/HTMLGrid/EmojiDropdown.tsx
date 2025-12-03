import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { useInlineEditorStatus } from '@/app/gridGL/HTMLGrid/inlineEditor/useInlineEditorStatus';
import { emojiMap, emojiStrings } from '@/app/gridGL/pixiApp/emojis/emojiMap';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { cn } from '@/shared/shadcn/utils';
import * as monaco from 'monaco-editor';
import type { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';

// Popular emojis to show first
const POPULAR_EMOJIS: (keyof typeof emojiMap)[] = ['smile', 'heart', '+1', '-1', 'fire', 'joy', 'sob'];

interface EmojiItem {
  name: string;
  emoji: string;
}

export const EmojiDropdown = () => {
  const inlineEditorStatus = useInlineEditorStatus();

  const [emojiList, setEmojiList] = useState<EmojiItem[]>([]);
  const [filteredList, setFilteredList] = useState<EmojiItem[] | undefined>();
  const [offsets, setOffsets] = useState<Rectangle | undefined>();
  const [index, setIndex] = useState(0);
  const [colonPosition, setColonPosition] = useState<{ column: number; lineNumber: number } | undefined>();
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Build emoji list from emojiMap
  useEffect(() => {
    const allEmojis: EmojiItem[] = [];
    const popularEmojis: EmojiItem[] = [];

    // Add popular emojis first
    for (const name of POPULAR_EMOJIS) {
      const emoji = emojiMap[name as keyof typeof emojiMap];
      if (emoji) {
        popularEmojis.push({ name, emoji });
      }
    }

    // Add all other emojis
    for (const [name, emoji] of Object.entries(emojiMap)) {
      if (!POPULAR_EMOJIS.includes(name as keyof typeof emojiMap)) {
        allEmojis.push({ name, emoji });
      }
    }

    // Sort alphabetically (excluding popular)
    allEmojis.sort((a, b) => a.name.localeCompare(b.name));

    // Combine popular + sorted
    setEmojiList([...popularEmojis, ...allEmojis]);
  }, []);

  useEffect(() => {
    const valueChanged = (input = inlineEditorMonaco.get()) => {
      // Skip if in formula mode
      if (inlineEditorHandler.formula) {
        setFilteredList(undefined);
        inlineEditorMonaco.setShowingEmojiList(false);
        return;
      }

      const model = inlineEditorMonaco.editor?.getModel();
      const position = inlineEditorMonaco.getPosition();
      if (!model || !position) {
        setFilteredList(undefined);
        inlineEditorMonaco.setShowingEmojiList(false);
        return;
      }

      // Get text before cursor
      const textBeforeCursor = input.substring(0, model.getOffsetAt(position));

      // Look for the last colon - check if it's at the start or after whitespace
      const lastColonIndex = textBeforeCursor.lastIndexOf(':');
      if (lastColonIndex !== -1) {
        const textAfterColon = textBeforeCursor.substring(lastColonIndex + 1);

        // Don't show dropdown if there's a space after the colon
        if (textAfterColon.includes(' ')) {
          setFilteredList(undefined);
          inlineEditorMonaco.setShowingEmojiList(false);
          return;
        }

        // Check if colon is at the start or preceded by whitespace or an emoji
        const textBeforeColon = textBeforeCursor.substring(0, lastColonIndex);
        if (textBeforeColon !== '' && !textBeforeColon.match(/\s$/)) {
          // Check if the character(s) before the colon is an emoji
          // Emojis can be multi-character (e.g., flag emojis, ZWJ sequences, variation selectors)
          // Max emoji length in our set is 8 characters
          let isEmojiPreceding = false;
          const chars = Array.from(textBeforeColon);
          for (let len = 1; len <= Math.min(8, chars.length); len++) {
            const potentialEmoji = chars.slice(-len).join('');
            if (emojiStrings.has(potentialEmoji)) {
              isEmojiPreceding = true;
              break;
            }
          }

          // If not preceded by emoji, don't show dropdown (like "test:")
          if (!isEmojiPreceding) {
            setFilteredList(undefined);
            inlineEditorMonaco.setShowingEmojiList(false);
            return;
          }
        }

        // Only match lowercase letters, numbers, underscores, and hyphens after colon
        const colonMatch = textBeforeCursor.match(/:([a-z0-9_-]*)$/);

        if (colonMatch) {
          const searchTerm = colonMatch[1]; // text after the colon

          // Store the colon position for later replacement
          const colonOffset = textBeforeCursor.lastIndexOf(':');
          const colonPos = model.getPositionAt(colonOffset);
          setColonPosition({ column: colonPos.column, lineNumber: colonPos.lineNumber });

          // Filter emojis
          if (searchTerm === '') {
            // Show popular emojis when just ":" is typed
            const popular = emojiList.filter((e) => POPULAR_EMOJIS.includes(e.name as keyof typeof emojiMap));
            setFilteredList(popular);
            inlineEditorMonaco.setShowingEmojiList(true);
            setIndex(0);

            // Update offsets
            const pos = sheets.sheet.cursor.position;
            setOffsets(sheets.sheet.getCellOffsets(pos.x, pos.y));
          } else {
            // Filter based on search term
            const matches = emojiList.filter((e) => e.name.toLowerCase().includes(searchTerm.toLowerCase()));

            if (matches.length > 0) {
              setFilteredList(matches);
              inlineEditorMonaco.setShowingEmojiList(true);
              setIndex(0);

              // Update offsets
              const pos = sheets.sheet.cursor.position;
              setOffsets(sheets.sheet.getCellOffsets(pos.x, pos.y));
            } else {
              setFilteredList(undefined);
              inlineEditorMonaco.setShowingEmojiList(false);
            }
          }
        } else {
          setFilteredList(undefined);
          inlineEditorMonaco.setShowingEmojiList(false);
        }
      } else {
        setFilteredList(undefined);
        inlineEditorMonaco.setShowingEmojiList(false);
      }
    };

    inlineEditorEvents.on('valueChanged', valueChanged);

    return () => {
      inlineEditorEvents.off('valueChanged', valueChanged);
    };
  }, [emojiList]);

  const insertEmoji = useCallback(
    (emoji: EmojiItem) => {
      if (!colonPosition) return;

      const model = inlineEditorMonaco.editor?.getModel();
      const position = inlineEditorMonaco.getPosition();
      if (!model || !position) return;

      // Calculate the range to replace (from : to cursor)
      const range = new monaco.Range(
        colonPosition.lineNumber,
        colonPosition.column,
        position.lineNumber,
        position.column
      );

      // Replace with emoji
      model.applyEdits([{ range, text: emoji.emoji }]);

      // Move cursor to after the emoji
      const newPosition = model.getPositionAt(model.getOffsetAt(colonPosition) + emoji.emoji.length);
      inlineEditorMonaco.editor?.setPosition(newPosition);

      // Close dropdown
      setFilteredList(undefined);
      inlineEditorMonaco.setShowingEmojiList(false);
      setIndex(0);
      setColonPosition(undefined);
    },
    [colonPosition]
  );

  // Scroll to selected item when index changes
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [index]);

  // Handle keyboard events when list is open
  useEffect(() => {
    const dropdownKeyboard = (key: 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape' | 'Tab') => {
      if (!filteredList || filteredList.length === 0) return;

      if (key === 'ArrowDown') {
        setIndex((index) => (index + 1) % filteredList.length);
      } else if (key === 'ArrowUp') {
        setIndex((index) => (index - 1 + filteredList.length) % filteredList.length);
      } else if (key === 'Enter' || key === 'Tab') {
        if (index >= 0 && index < filteredList.length) {
          insertEmoji(filteredList[index]);
        }
      } else if (key === 'Escape') {
        setFilteredList(undefined);
        inlineEditorMonaco.setShowingEmojiList(false);
        setIndex(0);
        setColonPosition(undefined);
      }
    };

    events.on('emojiDropdownKeyboard', dropdownKeyboard);
    return () => {
      events.off('emojiDropdownKeyboard', dropdownKeyboard);
    };
  }, [filteredList, index, insertEmoji]);

  if (!filteredList || filteredList.length === 0 || !offsets) return null;

  return (
    <div
      className={cn(
        'pointer-events-auto absolute cursor-pointer overflow-y-auto rounded-sm border border-border bg-background text-muted-foreground',
        inlineEditorStatus ? 'mt-1' : 'mt-0'
      )}
      style={{
        top: offsets.bottom,
        left: offsets.left,
        transformOrigin: `0 0`,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
        minWidth: 200,
        maxWidth: 300,
        maxHeight: `min(300px, calc(${pixiApp.viewport.bottom - offsets.bottom}px))`,
      }}
    >
      <div className="pointer-up-ignore block w-full px-1 py-1">
        {filteredList.map((item, i) => (
          <div
            ref={i === index ? selectedItemRef : null}
            className={cn(
              'flex w-full items-center gap-2 rounded px-2 py-1 hover:bg-accent',
              i === index ? 'bg-accent' : ''
            )}
            key={item.name}
            onClick={() => insertEmoji(item)}
          >
            <span className="text-lg">{item.emoji}</span>
            <span className="text-sm">:{item.name}:</span>
          </div>
        ))}
      </div>
    </div>
  );
};
