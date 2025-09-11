import { aiCodeCellSummaryStore } from '@/app/ai/utils/aiCodeCellSummaryStore';
import { formulaBarExpandedAtom } from '@/app/atoms/formulaBarAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, Cross2Icon, Pencil1Icon } from '@radix-ui/react-icons';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

export const FormulaBar = memo(() => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [displayValue, setDisplayValue] = useState('');
  const [isExpanded, setIsExpanded] = useRecoilState(formulaBarExpandedAtom);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [aiSummaryData, setAiSummaryData] = useState<{
    summary: string;
    explanation: string;
    fullText: string;
  } | null>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Don't adjust height when expanded - let it use the fixed expanded height
      if (isExpanded || isEditing) {
        return;
      }

      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';

      // Force a reflow to ensure we get accurate scrollHeight
      void textarea.offsetHeight;

      // Get the actual scroll height which accounts for both line breaks and text wrapping
      const scrollHeight = textarea.scrollHeight;

      // Set minimum height of 32px (single line) and use scroll height for multi-line
      const minHeight = 32;
      const newHeight = Math.max(minHeight, scrollHeight);

      textarea.style.height = `${newHeight}px`;

      // Ensure the textarea scrolls to top to show the first line
      textarea.scrollTop = 0;
    }
  }, [isExpanded, isEditing]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const startEditing = () => {
    console.log('[FormulaBar] Starting edit mode, displayValue:', displayValue);

    // For AI summary cells, we want to edit the full summary text (summary + explanation)
    let valueToEdit = displayValue;
    if (aiSummaryData) {
      // Use the full text (summary + explanation) for editing
      valueToEdit = aiSummaryData.fullText;
    }

    console.log('[FormulaBar] Edit value set to:', valueToEdit);
    setEditValue(valueToEdit);
    setIsEditing(true);
    setIsExpanded(true); // Automatically expand when editing starts
  };

  const cancelEditing = () => {
    setEditValue('');
    setIsEditing(false);
    // Optionally collapse if it was expanded only for editing (not for AI summary)
    if (!aiSummaryData) {
      setIsExpanded(false);
    }
  };

  const submitEdit = () => {
    // TODO: Implement submit functionality
    console.log('Submit edit:', editValue);
    setIsEditing(false);
    // Optionally collapse if it was expanded only for editing (not for AI summary)
    if (!aiSummaryData) {
      setIsExpanded(false);
    }
  };

  const updateDisplayValue = useCallback(async () => {
    try {
      const cursor = sheets.sheet.cursor.position;
      const { x, y } = cursor;

      // First check if this cell has an AI summary
      const aiSummary = aiCodeCellSummaryStore.getSummary(sheets.current, x, y);
      console.log('[FormulaBar] Checking for AI summary at:', x, y, 'found:', aiSummary);
      if (aiSummary) {
        console.log('[FormulaBar] Displaying AI summary:', aiSummary);

        // Try to parse as JSON (new format with summary/explanation)
        try {
          const parsedSummary = JSON.parse(aiSummary);
          if (parsedSummary.summary && parsedSummary.explanation) {
            setAiSummaryData(parsedSummary);
            setDisplayValue(isExpanded ? parsedSummary.fullText : parsedSummary.summary);
            return;
          }
        } catch (e) {
          // Not JSON, treat as legacy format
        }

        // Legacy format - just display as is
        setAiSummaryData(null);
        setDisplayValue(aiSummary);
        return;
      }

      // Clear AI summary data for non-AI cells
      setAiSummaryData(null);
      setIsExpanded(false);
      setIsEditing(false);

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
  }, [isExpanded]);

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
  }, [updateDisplayValue, adjustHeight]);

  useEffect(() => {
    // Use requestAnimationFrame to ensure the DOM is updated with new content before adjusting height
    const adjustAfterRender = () => {
      requestAnimationFrame(() => {
        adjustHeight();
      });
    };

    adjustAfterRender();
  }, [displayValue, editValue, isExpanded, isEditing, adjustHeight]);

  // Update display value when expansion state changes
  useEffect(() => {
    if (aiSummaryData) {
      setDisplayValue(isExpanded ? aiSummaryData.fullText : aiSummaryData.summary);
    }
  }, [isExpanded, aiSummaryData]);

  return (
    <div className="relative flex w-full flex-grow">
      <div className="flex w-full items-start justify-center px-4 py-1">
        <textarea
          ref={textareaRef}
          className={`min-h-8 w-full resize-none border-none bg-transparent px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 ${
            isEditing ? 'pr-32' : aiSummaryData ? 'pr-20' : 'pr-16'
          }`}
          value={isEditing ? editValue : displayValue}
          rows={1}
          readOnly={!isEditing}
          onInput={(e) => {
            if (isEditing) {
              setEditValue(e.currentTarget.value);
              adjustHeight();
            }
          }}
          onChange={(e) => {
            if (isEditing) {
              setEditValue(e.target.value);
            }
          }}
          style={{
            lineHeight: '1.25rem',
            overflow: isExpanded || isEditing ? 'auto' : 'hidden', // Allow scrolling when expanded or editing
            whiteSpace: 'pre-wrap', // Preserve line breaks and wrap text
            wordBreak: 'break-word', // Break long words if needed
            overflowWrap: 'break-word', // Additional word breaking support
            minHeight: '32px', // Ensure minimum height
            height: isExpanded || isEditing ? '120px' : 'auto', // Fixed height when expanded or editing
            maxHeight: isExpanded || isEditing ? '120px' : '60px', // Limit height when expanded/editing and collapsed
          }}
        />

        {/* Action buttons */}
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {/* Edit/Submit/Cancel buttons */}
          {!isEditing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-700"
              title="Edit"
            >
              <span>Edit</span>
              <Pencil1Icon className="h-3 w-3" />
            </button>
          ) : (
            <>
              <button
                onClick={submitEdit}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-green-600 transition-colors hover:bg-green-50 hover:text-green-700"
                title="Submit"
              >
                <span>Submit</span>
                <CheckIcon className="h-3 w-3" />
              </button>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                title="Cancel"
              >
                <span>Cancel</span>
                <Cross2Icon className="h-3 w-3" />
              </button>
            </>
          )}

          {/* Expand/Collapse button for AI summaries */}
          {aiSummaryData && (
            <button
              onClick={toggleExpanded}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
              title={isExpanded ? 'Collapse' : 'Explain'}
            >
              <span>{isExpanded ? 'Collapse' : 'Explain'}</span>
              {isExpanded ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
