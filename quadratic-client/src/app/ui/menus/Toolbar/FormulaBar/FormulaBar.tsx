import { aiCodeCellSummaryStore } from '@/app/ai/utils/aiCodeCellSummaryStore';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { memo, useEffect, useRef, useState } from 'react';

export const FormulaBar = memo(() => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [displayValue, setDisplayValue] = useState('');

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';

      // Force a reflow to ensure we get accurate scrollHeight
      textarea.offsetHeight;

      // Get the actual scroll height which accounts for both line breaks and text wrapping
      const scrollHeight = textarea.scrollHeight;

      // Set minimum height of 32px (single line) and use scroll height for multi-line
      const minHeight = 32;
      const newHeight = Math.max(minHeight, scrollHeight);

      textarea.style.height = `${newHeight}px`;

      // Ensure the textarea scrolls to top to show the first line
      textarea.scrollTop = 0;
    }
  };

  const updateDisplayValue = async () => {
    try {
      const cursor = sheets.sheet.cursor.position;
      const { x, y } = cursor;

      // First check if this cell has an AI summary
      const aiSummary = aiCodeCellSummaryStore.getSummary(sheets.current, x, y);
      console.log('[FormulaBar] Checking for AI summary at:', x, y, 'found:', aiSummary);
      if (aiSummary) {
        console.log('[FormulaBar] Displaying AI summary:', aiSummary);
        setDisplayValue(aiSummary);
        return;
      }

      const cellRef = xyToA1(x, y);

      // Check if it's a code cell first
      const codeCell = await quadraticCore.getCodeCell(sheets.current, x, y);

      if (codeCell) {
        if (codeCell.language === 'Formula') {
          // Show formula with = prefix
          setDisplayValue(`=${codeCell.code_string}`);
        } else if (codeCell.language === 'Python') {
          // Show Python code cell name/reference
          setDisplayValue(`Python: ${cellRef}`);
        } else {
          // Show other code cell types
          setDisplayValue(`${codeCell.language}: ${cellRef}`);
        }
      } else {
        // Check if cell has a value
        const cellValue = await quadraticCore.getCellValue(sheets.current, x, y);
        if (cellValue && cellValue.value !== undefined && cellValue.value !== '') {
          // Cell has content but no formula - show the actual cell value
          let displayVal = cellValue.value;

          // Handle different value types appropriately
          if (cellValue.kind === 'Number') {
            displayVal = cellValue.value.toString();
          } else if (cellValue.kind === 'Date' || cellValue.kind === 'DateTime') {
            displayVal = new Date(cellValue.value).toLocaleString();
          } else if (cellValue.kind === 'Logical') {
            displayVal = cellValue.value ? 'TRUE' : 'FALSE';
          } else {
            displayVal = cellValue.value.toString();
          }

          setDisplayValue(displayVal);
        } else {
          // Empty cell - show just the cell reference
          setDisplayValue(cellRef);
        }
      }
    } catch (error) {
      console.error('Error updating formula bar:', error);
      // Fallback to just showing cell reference
      setDisplayValue(sheets.sheet.cursor.toA1String());
    }
  };

  useEffect(() => {
    updateDisplayValue();
    adjustHeight();

    events.on('cursorPosition', updateDisplayValue);
    events.on('changeSheet', updateDisplayValue);

    // Handle window resize to recalculate height if needed
    const handleResize = () => {
      setTimeout(adjustHeight, 0); // Use setTimeout to ensure DOM is updated
    };
    window.addEventListener('resize', handleResize);

    return () => {
      events.off('cursorPosition', updateDisplayValue);
      events.off('changeSheet', updateDisplayValue);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    // Use requestAnimationFrame to ensure the DOM is updated with new content before adjusting height
    const adjustAfterRender = () => {
      requestAnimationFrame(() => {
        adjustHeight();
      });
    };

    adjustAfterRender();
  }, [displayValue]);

  return (
    <div className="flex w-full flex-grow">
      <div className="flex w-full items-start justify-center px-4 py-1">
        <textarea
          ref={textareaRef}
          className="min-h-8 w-full resize-none border-none bg-transparent px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          value={displayValue}
          rows={1}
          onInput={(e) => {
            setDisplayValue(e.currentTarget.value);
            adjustHeight();
          }}
          onChange={(e) => setDisplayValue(e.target.value)}
          style={{
            lineHeight: '1.25rem',
            overflow: 'hidden', // Prevent scrollbars since we're auto-sizing
            whiteSpace: 'pre-wrap', // Preserve line breaks and wrap text
            wordBreak: 'break-word', // Break long words if needed
            overflowWrap: 'break-word', // Additional word breaking support
            minHeight: '32px', // Ensure minimum height
          }}
        />
      </div>
    </div>
  );
});
