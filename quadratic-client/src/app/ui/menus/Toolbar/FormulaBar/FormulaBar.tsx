import { aiCodeCellSummaryStore } from '@/app/ai/utils/aiCodeCellSummaryStore';
import { generateCodeCellSummary } from '@/app/ai/utils/generateCodeCellSummary';
import { formulaBarExpandedAtom } from '@/app/atoms/formulaBarAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { LightbulbIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { CheckIcon, Cross2Icon, Pencil1Icon } from '@radix-ui/react-icons';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
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
  const [cellInfo, setCellInfo] = useState<{
    language?: string;
    cellRef: string;
    showIcon: boolean;
    isAIGenerated: boolean;
    isAIFormula?: boolean;
    canHaveAISummary: boolean;
    codeString?: string;
  }>({ cellRef: '', showIcon: false, isAIGenerated: false, canHaveAISummary: false });
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const { submitPrompt } = useSubmitAIAnalystPrompt();

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

  const handleExplainEdit = async () => {
    // If this cell already has an AI summary, start editing
    if (aiSummaryData) {
      startEditing();
      return;
    }

    // If this cell doesn't have an AI summary but can have one, generate it
    if (cellInfo.canHaveAISummary && cellInfo.codeString) {
      await generateSummaryForCell();
      return;
    }
  };

  const generateSummaryForCell = async () => {
    if (!cellInfo.codeString || !cellInfo.language) return;

    setIsGeneratingSummary(true);
    try {
      const cursor = sheets.sheet.cursor.position;
      const { x, y } = cursor;

      console.log('[FormulaBar] Generating AI summary for cell:', cellInfo.cellRef);
      const summary = await generateCodeCellSummary(cellInfo.codeString, cellInfo.language, x, y);

      // Store the summary
      aiCodeCellSummaryStore.setSummary(sheets.current, x, y, summary, cellInfo.codeString);

      // Update the display to show the new summary
      await updateDisplayValue();

      console.log('[FormulaBar] Successfully generated and stored AI summary');
    } catch (error) {
      console.error('[FormulaBar] Failed to generate AI summary:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const startEditing = () => {
    console.log('[FormulaBar] Starting edit mode, displayValue:', displayValue);

    // For AI summary cells, we want to edit the full summary text (summary + explanation)
    let valueToEdit = displayValue;
    if (aiSummaryData) {
      // Use the full text (summary + explanation) for editing, not the formatted task list
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
    // Always collapse when cancelling edit mode
    setIsExpanded(false);
  };

  const submitEdit = async () => {
    console.log('Submit edit:', editValue);

    // Get current cursor position for cell location
    const cursor = sheets.sheet.cursor.position;
    const { x, y } = cursor;
    const cellLocation = xyToA1(x, y);

    // Get the current code cell to understand what we're editing
    const codeCell = await quadraticCore.getCodeCell(sheets.current, x, y);

    if (codeCell && aiSummaryData) {
      // Get old summary information
      const oldSummary = aiSummaryData.summary;
      const oldExplanation = aiSummaryData.explanation;

      // Format the message for AI analyst
      const message = `The user has requested an edit to the code cell at ${cellLocation}.

Currently the code does:
${oldSummary}

${oldExplanation}

New change:
${editValue}`;

      // Submit to AI analyst
      try {
        await submitPrompt({
          content: [createTextContent(message)],
          messageSource: 'FormulaBarEdit',
          context: {
            sheets: [sheets.sheet.name],
            currentSheet: sheets.sheet.name,
            selection: cellLocation,
          },
          messageIndex: 0,
        });
      } catch (error) {
        console.warn('Failed to submit edit to AI analyst:', error);
      }
    }

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
            setCellInfo({
              cellRef: xyToA1(x, y),
              showIcon: true,
              isAIGenerated: true,
              isAIFormula: false,
              canHaveAISummary: true,
              codeString: '',
              language: '',
            });
            return;
          }
        } catch (e) {
          // Not JSON, treat as legacy format
        }

        // Legacy format - just display as is
        setAiSummaryData(null);
        setDisplayValue(aiSummary);
        setCellInfo({
          cellRef: xyToA1(x, y),
          showIcon: true,
          isAIGenerated: true,
          isAIFormula: false,
          canHaveAISummary: true,
          codeString: '',
          language: '',
        });
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
        const language = getConnectionKind(codeCell.language);

        if (codeCell.language === 'Formula') {
          // Check if this formula cell has an AI summary
          const formulaAiSummary = aiCodeCellSummaryStore.getSummary(sheets.current, x, y, codeCell.code_string);

          if (formulaAiSummary) {
            // This is an AI-generated formula, treat it like other AI summaries
            console.log('[FormulaBar] Found AI summary for formula cell:', formulaAiSummary);

            // Try to parse as JSON (new format with summary/explanation)
            try {
              const parsedSummary = JSON.parse(formulaAiSummary);
              if (parsedSummary.summary && parsedSummary.explanation) {
                setAiSummaryData(parsedSummary);
                setDisplayValue(isExpanded ? parsedSummary.fullText : parsedSummary.summary);
                setCellInfo({
                  cellRef,
                  showIcon: true,
                  isAIGenerated: true,
                  isAIFormula: true,
                  canHaveAISummary: true,
                  codeString: codeCell.code_string,
                  language: 'Formula',
                });
                return;
              }
            } catch (e) {
              // Not JSON, treat as legacy format
            }

            // Legacy format - just display as is
            setAiSummaryData(null);
            setDisplayValue(formulaAiSummary);
            setCellInfo({
              cellRef,
              showIcon: true,
              isAIGenerated: true,
              isAIFormula: true,
              canHaveAISummary: true,
              codeString: codeCell.code_string,
              language: 'Formula',
            });
            return;
          } else {
            // Regular formula without AI summary - show formula with = prefix
            setDisplayValue(`=${codeCell.code_string}`);
            setCellInfo({
              language: 'Formula',
              cellRef,
              showIcon: true,
              isAIGenerated: false,
              isAIFormula: false,
              canHaveAISummary: true,
              codeString: codeCell.code_string,
            });
          }
        } else {
          // For code cells, show just the cell reference in the textarea
          // The language and icon will be shown separately
          setDisplayValue(cellRef);
          const cellLanguage = language || (typeof codeCell.language === 'string' ? codeCell.language : 'Connection');
          setCellInfo({
            language: cellLanguage,
            cellRef,
            showIcon: true,
            isAIGenerated: false,
            isAIFormula: false,
            canHaveAISummary: cellLanguage !== 'Import', // Don't show AI explain for data tables
            codeString: codeCell.code_string,
          });
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
          setCellInfo({ cellRef, showIcon: false, isAIGenerated: false, isAIFormula: false, canHaveAISummary: false });
        } else {
          // Empty cell - show just the cell reference
          setDisplayValue(cellRef);
          setCellInfo({ cellRef, showIcon: false, isAIGenerated: false, isAIFormula: false, canHaveAISummary: false });
        }
      }
    } catch (error) {
      console.error('Error updating formula bar:', error);
      // Fallback to just showing cell reference
      const fallbackRef = sheets.sheet.cursor.toA1String();
      setDisplayValue(fallbackRef);
      setCellInfo({
        cellRef: fallbackRef,
        showIcon: false,
        isAIGenerated: false,
        isAIFormula: false,
        canHaveAISummary: false,
      });
    }
  }, [isExpanded, setIsExpanded]);

  useEffect(() => {
    updateDisplayValue();
    adjustHeight();

    events.on('cursorPosition', updateDisplayValue);
    events.on('changeSheet', updateDisplayValue);
    events.on('updateCodeCells', updateDisplayValue); // Update when code cells change (including deletions)

    // Handle window resize to recalculate height if needed
    const handleResize = () => {
      setTimeout(adjustHeight, 0); // Use setTimeout to ensure DOM is updated
    };
    window.addEventListener('resize', handleResize);

    return () => {
      events.off('cursorPosition', updateDisplayValue);
      events.off('changeSheet', updateDisplayValue);
      events.off('updateCodeCells', updateDisplayValue);
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
      if (isExpanded) {
        // Format as task list with subtitle
        const formattedTaskList = formatAsTaskList(aiSummaryData.explanation);
        setDisplayValue(formattedTaskList);
      } else {
        setDisplayValue(aiSummaryData.summary);
      }
    }
  }, [isExpanded, aiSummaryData]);

  // Helper function to format the explanation as a task list
  const formatAsTaskList = (explanation: string): string => {
    const lines = explanation.split('\n').filter((line) => line.trim());
    const subtitle = 'What code does, step by step';

    let formattedList = `${subtitle}\n\n`;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine.match(/^\d+\./)) {
        // Convert numbered list to task list format
        const taskText = trimmedLine.replace(/^\d+\.\s*/, '');
        formattedList += `• ${taskText}\n`;
      } else if (trimmedLine) {
        // Handle any other non-empty lines
        formattedList += `• ${trimmedLine}\n`;
      }
    });

    return formattedList.trim();
  };

  return (
    <div className="relative flex w-full flex-grow">
      <div className="flex w-full items-start justify-center px-4 py-1">
        {/* Language icon and cell name - shown on the left for code cells */}
        {cellInfo.showIcon && (
          <div className="flex flex-shrink-0 items-center gap-2 px-2 py-2">
            {cellInfo.isAIGenerated ? (
              <LightbulbIcon className="h-4 w-4" />
            ) : (
              <LanguageIcon language={cellInfo.language} className="h-4 w-4" />
            )}
            <span className="text-sm font-medium text-muted-foreground">
              {cellInfo.isAIGenerated
                ? cellInfo.isAIFormula
                  ? 'AI formula'
                  : 'AI code'
                : cellInfo.language === 'Formula'
                  ? 'Formula'
                  : cellInfo.language === 'Import'
                    ? 'Table'
                    : cellInfo.language}
            </span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="min-h-8 w-full resize-none border-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
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

        {/* Action buttons - positioned in their own container to prevent text overlap */}
        {cellInfo.canHaveAISummary && (
          <div className="flex flex-shrink-0 items-center gap-1 border-l border-border px-2 py-1">
            {/* Edit/Submit/Cancel buttons - show for all code/formula cells */}
            {!isEditing ? (
              <button
                onClick={handleExplainEdit}
                disabled={isGeneratingSummary}
                className="flex items-center gap-1 rounded border-2 border-blue-300/60 bg-gradient-to-r from-blue-100 via-indigo-100 to-purple-100 px-2 py-1 text-xs font-semibold text-blue-700 shadow-lg shadow-blue-200/50 ring-1 ring-blue-200/30 transition-all duration-200 hover:scale-105 hover:border-blue-400 hover:from-blue-200 hover:via-indigo-200 hover:to-purple-200 hover:text-blue-800 hover:shadow-xl hover:shadow-blue-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  aiSummaryData
                    ? isExpanded
                      ? 'Edit AI summary'
                      : 'Explain and edit AI summary'
                    : 'Generate AI explanation'
                }
              >
                <span>
                  {isGeneratingSummary ? 'Generating...' : aiSummaryData ? 'AI edit / explain' : 'AI explain'}
                </span>
                <Pencil1Icon className="h-3 w-3" />
              </button>
            ) : (
              <>
                <button
                  onClick={submitEdit}
                  className="flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 hover:text-green-800"
                  title="Submit"
                >
                  <span>Submit prompt</span>
                  <CheckIcon className="h-3 w-3" />
                </button>
                <button
                  onClick={cancelEditing}
                  className="flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 hover:text-red-800"
                  title="Cancel"
                >
                  <span>Cancel</span>
                  <Cross2Icon className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
