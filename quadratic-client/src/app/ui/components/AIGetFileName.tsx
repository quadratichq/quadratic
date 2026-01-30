import { currentChatMessagesAtom, loadingAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { useGetFileName } from '@/app/ai/hooks/useGetFileName';
import { countWords } from '@/app/ai/utils/wordCount';
import { aiAssistantLoadingAtom, aiAssistantMessagesAtom } from '@/app/atoms/codeEditorAtom';
import { fileManuallyRenamedAtom } from '@/app/atoms/fileNamingAtom';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { DEFAULT_FILE_NAME } from '@/shared/constants/appConstants';
import { useAtomValue } from 'jotai';
import { getPromptMessagesForAI } from 'quadratic-shared/ai/helpers/message.helper';
import { memo, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const AIGetFileName = memo(() => {
  const { name, renameFile } = useFileContext();
  const aiAssistantLoading = useRecoilValue(aiAssistantLoadingAtom);
  const aiAnalystLoading = useAtomValue(loadingAtom);
  const fileManuallyRenamed = useRecoilValue(fileManuallyRenamedAtom);
  const aiAssistantMessages = useRecoilValue(aiAssistantMessagesAtom);
  const aiAnalystMessages = useAtomValue(currentChatMessagesAtom);

  const hasTriggeredRef = useRef(false);

  // Combine messages from both AIAssistant and AIAnalyst
  const allMessages = [...aiAssistantMessages, ...aiAnalystMessages];
  const promptMessages = getPromptMessagesForAI(allMessages);

  // Count user prompts (messages from user)
  const userPromptCount = promptMessages.filter((message) => message.role === 'user').length;

  const loading = aiAssistantLoading || aiAnalystLoading;

  // updates file name if conditions are met
  const { getFileName } = useGetFileName();
  const setFileManuallyRenamed = useSetRecoilState(fileManuallyRenamedAtom);

  useEffect(() => {
    // Conditions:
    // 1. Not loading
    // 2. File hasn't been manually renamed
    // 3. File name is still default ("Untitled")
    // 4. At least 3 user prompts (3 messages)
    // 5. Haven't already triggered for this message count
    const shouldTrigger =
      !loading &&
      !fileManuallyRenamed &&
      name === DEFAULT_FILE_NAME &&
      userPromptCount >= 3 &&
      !hasTriggeredRef.current;

    if (shouldTrigger) {
      hasTriggeredRef.current = true;
      getFileName()
        .then((fileName) => {
          if (fileName && fileName.trim() && fileName !== DEFAULT_FILE_NAME) {
            // Validate word count (1-3 words)
            const wordCount = countWords(fileName);

            if (wordCount >= 1 && wordCount <= 3) {
              renameFile(fileName);
              // renameFile already sets fileManuallyRenamed to true
            } else {
              console.warn(
                `[AIGetFileName] File name "${fileName}" has ${wordCount} words, but must be 1-3 words. Skipping rename.`
              );
            }
          }
        })
        .catch((error) => {
          console.error('[AIGetFileName] getFileName: ', error);
        });
    }
  }, [userPromptCount, name, fileManuallyRenamed, loading, getFileName, renameFile, setFileManuallyRenamed]);

  // Reset trigger when message count decreases (new chat started)
  useEffect(() => {
    if (userPromptCount < 3) {
      hasTriggeredRef.current = false;
    }
  }, [userPromptCount]);

  return null;
});
