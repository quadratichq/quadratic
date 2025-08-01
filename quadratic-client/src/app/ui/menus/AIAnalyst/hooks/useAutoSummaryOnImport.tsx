import { shouldAutoSummaryOnImportAtom } from '@/app/atoms/aiAnalystAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import mixpanel from 'mixpanel-browser';
import { useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

// Hook to watch for file import completion and auto-submit summary prompt
export function useAutoSummaryOnImport() {
  const { submitPrompt } = useSubmitAIAnalystPrompt();
  const [shouldAutoSummary, setShouldAutoSummary] = useRecoilState(shouldAutoSummaryOnImportAtom);
  const filesImportProgress = useRecoilValue(filesImportProgressAtom);
  const prevImportingRef = useRef(false);
  const importedFilesRef = useRef<Array<{ name: string; step: string }>>([]);

  useEffect(() => {
    // Add debugging
    if (shouldAutoSummary) {
      console.log('Auto-summary file import tracking:', {
        shouldAutoSummary,
        importing: filesImportProgress.importing,
        prevImporting: prevImportingRef.current,
        files: filesImportProgress.files,
        currentFileIndex: filesImportProgress.currentFileIndex,
      });
    }

    // Capture files data while importing
    if (shouldAutoSummary && filesImportProgress.importing) {
      importedFilesRef.current = filesImportProgress.files.map((f) => ({ name: f.name, step: f.step }));
      prevImportingRef.current = true;
    }

    // Check if import just completed (was importing, now not importing)
    if (shouldAutoSummary && prevImportingRef.current && !filesImportProgress.importing) {
      console.log('Import just completed:', {
        importedFiles: importedFilesRef.current,
        currentFiles: filesImportProgress.files,
      });

      const hadFiles = importedFilesRef.current.length > 0;
      const hasErrors = importedFilesRef.current.some((file) => file.step === 'error' || file.step === 'cancel');

      console.log('Import completion check:', {
        hadFiles,
        hasErrors,
        importedFiles: importedFilesRef.current,
      });

      if (hadFiles && !hasErrors) {
        // Add a small delay to ensure the grid has updated with the new data
        setTimeout(() => {
          console.log('Triggering auto-summary after file import');
          mixpanel.track('[AutoSummary].triggeredAfterImport', {
            fileCount: importedFilesRef.current.length,
            fileNames: importedFilesRef.current.map((f) => f.name),
          });

          submitPrompt({
            messageSource: 'AutoSummary',
            content: [
              {
                type: 'text',
                text: 'Tell me a summary of this data. Just explain succinctly in chat; do not write any code nor write to the sheet.',
              },
            ],
            context: { sheets: [], currentSheet: sheets.sheet.name, selection: undefined },
            messageIndex: 0,
          });
        }, 1000);
      }

      // Reset everything
      setShouldAutoSummary(false);
      prevImportingRef.current = false;
      importedFilesRef.current = [];
    }
  }, [
    shouldAutoSummary,
    filesImportProgress.importing,
    filesImportProgress.files,
    filesImportProgress.currentFileIndex,
    submitPrompt,
    setShouldAutoSummary,
  ]);
}
