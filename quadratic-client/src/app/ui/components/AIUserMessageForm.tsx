import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import { type ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { events } from '@/app/events/events';
import { getExtension } from '@/app/helpers/files';
import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { AIContext } from '@/app/ui/components/AIContext';
import { AIUsageExceeded } from '@/app/ui/components/AIUsageExceeded';
import { AIUserMessageFormAttachFileButton } from '@/app/ui/components/AIUserMessageFormAttachFileButton';
import { AIUserMessageFormConnectionsButton } from '@/app/ui/components/AIUserMessageFormConnectionsButton';
import { AIUserMessageFormTuneMenu } from '@/app/ui/components/AIUserMessageFormTuneMenu';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import {
  detectMentionInText,
  getMentionCursorPosition,
  MentionsTextarea,
  useMentionsState,
} from '@/app/ui/components/MentionsTextarea';
import { AIAnalystEmptyChatPromptSuggestions } from '@/app/ui/menus/AIAnalyst/AIAnalystEmptyChatPromptSuggestions';
import { ArrowUpwardIcon, BackspaceIcon, MentionIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isSupportedMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import { createTextContent, isContentFile, isContentText } from 'quadratic-shared/ai/helpers/message.helper';
import type { Content, Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import type { SetterOrUpdater } from 'recoil';

export interface AIUserMessageFormWrapperProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  autoFocusRef?: React.RefObject<boolean>;
  initialContent?: Content;
  initialContext?: Context;
  messageIndex: number;
  onContentChange?: (content: Content) => void;
  showEmptyChatPromptSuggestions?: boolean;
  uiContext: 'analyst-new-chat' | 'analyst-edit-chat' | 'assistant-new-chat' | 'assistant-edit-chat';
}

export interface SubmitPromptArgs {
  content: Content;
  context: Context;
  importFiles: ImportFile[];
}

interface AIUserMessageFormProps extends AIUserMessageFormWrapperProps {
  abortController: AbortController | undefined;
  loading: boolean;
  setLoading: SetterOrUpdater<boolean>;
  cancelDisabled: boolean;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  submitPrompt: (args: SubmitPromptArgs) => void;
  isChatFileSupported: (mimeType: string) => boolean;
  isImportFileSupported: (extension: string) => boolean;
  fileTypes: string[];
  formOnKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  maxHeight?: string;
  waitingOnMessageIndex?: number;
  filesSupportedText: string;
}
export const AIUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormProps>((props: AIUserMessageFormProps, ref) => {
    const {
      textareaRef: bottomTextareaRef,
      autoFocusRef,
      initialContent,
      initialContext,
      messageIndex,
      onContentChange,
      showEmptyChatPromptSuggestions,
      abortController,
      loading,
      setLoading,
      cancelDisabled,
      context,
      setContext,
      submitPrompt,
      isChatFileSupported,
      isImportFileSupported,
      fileTypes,
      formOnKeyDown,
      maxHeight = '120px',
      waitingOnMessageIndex,
      filesSupportedText,
      uiContext,
    } = props;

    const [editing, setEditing] = useState(!initialContent?.length);
    const editingOrDebugEditing = useMemo(() => editing || !!onContentChange, [editing, onContentChange]);

    const [dragOver, setDragOver] = useState(false);

    const [files, setFiles] = useState<FileContent[]>([]);
    const [importFiles, setImportFiles] = useState<ImportFile[]>([]);
    const [prompt, setPrompt] = useState<string>('');
    const isAnalyst = useMemo(() => uiContext.startsWith('analyst'), [uiContext]);

    useEffect(() => {
      if (initialContent) {
        setFiles(initialContent.filter((item) => isContentFile(item)) ?? []);
        setImportFiles([]);
        setPrompt(
          initialContent
            .filter((item) => isContentText(item))
            .map((item) => item.text)
            .join('\n')
        );
      }

      setContext?.(initialContext ? { ...initialContext } : {});
    }, [initialContent, initialContext, setContext, setPrompt]);

    const showAIUsageExceeded = useMemo(
      () => waitingOnMessageIndex === props.messageIndex,
      [props.messageIndex, waitingOnMessageIndex]
    );

    const handleClickForm = useCallback(
      (e: React.MouseEvent<HTMLFormElement>) => {
        // Don't focus if clicking the model selector popover (hack)
        if (editingOrDebugEditing && !(e.target as HTMLElement).closest('#ai-model-popover-content')) {
          textareaRef.current?.focus();
        }
      },
      [editingOrDebugEditing]
    );

    const handleSubmit = useCallback(
      (prompt: string) => {
        const trimmedPrompt = prompt.trim();
        if (trimmedPrompt.length === 0) return;

        submitPrompt({
          content: [...files, createTextContent(trimmedPrompt)],
          context,
          importFiles,
        });

        if (initialContent === undefined) {
          setFiles([]);
          setImportFiles([]);
          setPrompt('');
          setContext?.({});
        }
      },
      [context, files, importFiles, initialContent, setContext, submitPrompt]
    );

    const abortPrompt = useCallback(() => {
      abortController?.abort();
      setLoading(false);
    }, [abortController, setLoading]);

    const handlePromptChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(event.target.value);
        onContentChange?.([...files, createTextContent(event.target.value)]);
      },
      [files, onContentChange]
    );

    const handleFilesChange = useCallback(
      (newFiles: FileContent[]) => {
        setFiles(newFiles);
        onContentChange?.([...newFiles, createTextContent(prompt)]);
      },
      [onContentChange, prompt]
    );

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        event.stopPropagation();
        if (event.key === 'Enter' && !(event.ctrlKey || event.shiftKey)) {
          event.preventDefault();
          if (loading || waitingOnMessageIndex !== undefined) return;

          handleSubmit(prompt);

          if (initialContent === undefined) {
            textareaRef.current?.focus();
          } else {
            setEditing(false);
            bottomTextareaRef.current?.focus();
          }
        } else if (event.key === 'Escape') {
          if (initialContent === undefined) {
            focusGrid();
          } else {
            setEditing(false);
            bottomTextareaRef.current?.focus();
          }
        }

        if (loading || waitingOnMessageIndex !== undefined) return;

        if (formOnKeyDown) {
          formOnKeyDown(event);
        }
      },
      [bottomTextareaRef, formOnKeyDown, initialContent, loading, prompt, handleSubmit, waitingOnMessageIndex]
    );

    const handleFiles = useCallback(
      async (newFiles: FileList | File[]) => {
        if (newFiles && newFiles.length > 0) {
          for (const newFile of newFiles) {
            const mimeType = newFile.type;
            const extension = getExtension(newFile.name);
            if (isSupportedMimeType(mimeType) && isChatFileSupported(mimeType)) {
              const reader = new FileReader();
              reader.onloadend = (e) => {
                const dataUrl = e.target?.result as string;
                const base64 = dataUrl.split(',')[1];
                handleFilesChange([...files, { type: 'data', data: base64, mimeType, fileName: newFile.name }]);
              };
              reader.onerror = (e) => {
                console.error('Error reading file', e);
              };
              reader.readAsDataURL(newFile);
            } else if (isImportFileSupported(`.${extension}`)) {
              try {
                const data = await newFile.arrayBuffer();
                setImportFiles((prev) => [...prev, { name: newFile.name, size: newFile.size, data }]);
              } catch (error) {
                console.error('Error reading file', error);
              }
            }
          }
        }
      },
      [files, handleFilesChange, isChatFileSupported, isImportFileSupported]
    );

    const handlePasteOrDrop = useCallback(
      (e: ClipboardEvent<HTMLFormElement> | DragEvent<HTMLFormElement> | DragEvent<HTMLDivElement>) => {
        const filesToHandle =
          'clipboardData' in e ? e.clipboardData.files : 'dataTransfer' in e ? e.dataTransfer.files : null;
        setDragOver(false);
        if (editingOrDebugEditing && filesToHandle && filesToHandle.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleFiles(filesToHandle);
        }
      },
      [editingOrDebugEditing, handleFiles]
    );

    const handleDrag = useCallback(
      (e: DragEvent<HTMLFormElement | HTMLDivElement> | DragEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(editingOrDebugEditing && e.type !== 'dragleave');
      },
      [editingOrDebugEditing]
    );

    useEffect(() => {
      if (initialContent === undefined) {
        events.on('aiAnalystDroppedFiles', handleFiles);
      }
      return () => {
        events.off('aiAnalystDroppedFiles', handleFiles);
      };
    }, [handleFiles, initialContent]);

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => textareaRef.current!);

    // Focus the input when relevant & the tab comes into focus
    useEffect(() => {
      if (autoFocusRef?.current) {
        textareaRef.current?.focus();
      }
    }, [autoFocusRef, textareaRef]);

    useEffect(() => {
      if (loading && initialContent !== undefined) {
        setEditing(false);
      }
    }, [loading, initialContent]);

    const disabled = useMemo(
      () => waitingOnMessageIndex !== undefined || !editingOrDebugEditing,
      [waitingOnMessageIndex, editingOrDebugEditing]
    );

    // Mentions-related state & functionality
    const [mentionState, setMentionState] = useMentionsState();
    const handleClickMention = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      trackEvent('[AIMentions].clickInsertMentionButton');

      // Get current cursor position
      const cursorPos = textarea.selectionStart || 0;
      const currentValue = prompt;

      // Insert @ at cursor position
      const beforeCursor = currentValue.substring(0, cursorPos);
      const afterCursor = currentValue.substring(cursorPos);
      const newValue = beforeCursor + '@' + afterCursor;

      setPrompt(newValue);

      // Trigger mention detection using shared utilities
      const mention = detectMentionInText(newValue, cursorPos + 1);
      if (mention) {
        const position = getMentionCursorPosition(textarea);
        setMentionState((prev) => ({
          ...prev,
          isOpen: true,
          query: mention.query,
          startIndex: mention.startIndex,
          endIndex: mention.endIndex,
          position,
          selectedIndex: 0,
        }));
      }

      // Focus and position cursor after @
      textarea.focus();
      textarea.setSelectionRange(cursorPos + 1, cursorPos + 1);
    }, [textareaRef, prompt, setMentionState]);

    // Listen for when the user uses the "Reference in chat" action via the grid
    // Apply _only_ for new
    useEffect(() => {
      const handleAddReference = (reference: string) => {
        setPrompt((prev) => `${prev}${prev.length > 0 && !prev.endsWith(' ') ? ' ' : ''}@${reference} `);
        textareaRef.current?.focus();
      };
      if (uiContext === 'analyst-new-chat') {
        events.on('aiAnalystAddReference', handleAddReference);
      }
      return () => {
        events.off('aiAnalystAddReference', handleAddReference);
      };
    }, [uiContext]);

    const textarea = (
      <Textarea
        ref={textareaRef}
        value={prompt}
        className={cn(
          'rounded-none border-none p-2 pb-0 pt-1 shadow-none focus-visible:ring-0',
          editingOrDebugEditing ? 'min-h-14' : 'pointer-events-none !max-h-none overflow-hidden',
          (waitingOnMessageIndex !== undefined || showAIUsageExceeded) && 'pointer-events-none opacity-50'
        )}
        onChange={handlePromptChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        placeholder={
          uiContext.startsWith('analyst') ? 'Ask a question (use @ to reference the sheet).' : 'Ask a question.'
        }
        autoHeight={true}
        maxHeight={maxHeight}
        disabled={waitingOnMessageIndex !== undefined}
        onDragEnter={handleDrag}
        {...(isAnalyst && { 'data-ai-analyst-input': true })}
      />
    );

    return (
      <div className={cn(showEmptyChatPromptSuggestions && messageIndex === 0 ? '' : 'relative')}>
        {!!showEmptyChatPromptSuggestions && messageIndex === 0 && (
          <AIAnalystEmptyChatPromptSuggestions submit={handleSubmit} />
        )}

        <form
          className={cn(
            'group relative h-min rounded-lg border border-accent bg-accent pt-1.5 has-[textarea:focus]:border-primary',
            editingOrDebugEditing ? '' : 'select-none'
          )}
          onSubmit={(e) => e.preventDefault()}
          onClick={handleClickForm}
          onPaste={handlePasteOrDrop}
          onDrop={handlePasteOrDrop}
        >
          {editingOrDebugEditing && dragOver && (
            <div
              className="absolute bottom-2 left-2 right-2 top-2 z-20 flex flex-col items-center justify-center rounded bg-background opacity-90"
              onDrop={handlePasteOrDrop}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
            >
              <div className="pointer-events-none relative z-10 flex h-full w-full select-none flex-col items-center justify-center rounded-md border-4 border-dashed border-primary p-4">
                <span className="text-sm font-bold">Drop files here</span>
                <span className="pl-4 pr-4 text-center text-xs text-muted-foreground">
                  {filesSupportedText} supported
                </span>
              </div>
            </div>
          )}

          <EditButton
            show={!editingOrDebugEditing && !loading && waitingOnMessageIndex === undefined}
            loading={loading}
            setEditing={setEditing}
            textareaRef={textareaRef}
          />

          <AIContext
            context={context}
            setContext={setContext}
            files={files}
            setFiles={handleFilesChange}
            importFiles={importFiles}
            setImportFiles={setImportFiles}
            disabled={disabled}
            textareaRef={textareaRef}
          />

          {/* Don't use @-mentions if we're not in the analyst */}
          {isAnalyst ? (
            <MentionsTextarea textareaRef={textareaRef} mentionState={mentionState} setMentionState={setMentionState}>
              {textarea}
            </MentionsTextarea>
          ) : (
            textarea
          )}

          {showAIUsageExceeded && <AIUsageExceeded />}

          <AIUserMessageFormFooter
            show={editing}
            loading={loading}
            waitingOnMessageIndex={waitingOnMessageIndex}
            textareaRef={textareaRef}
            prompt={prompt}
            setPrompt={setPrompt}
            submitPrompt={handleSubmit}
            abortPrompt={abortPrompt}
            disabled={disabled}
            cancelDisabled={cancelDisabled}
            handleFiles={handleFiles}
            fileTypes={fileTypes}
            handleClickMention={handleClickMention}
            context={context}
            setContext={setContext}
            filesSupportedText={filesSupportedText}
            isAnalyst={isAnalyst}
          />
        </form>
      </div>
    );
  })
);

interface EditButtonProps {
  show: boolean;
  loading: boolean;
  setEditing: (editing: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
const EditButton = memo(({ show, loading, setEditing, textareaRef }: EditButtonProps) => {
  if (!show) {
    return null;
  }

  return (
    <button
      className="absolute bottom-0 left-0 right-0 top-0 z-10 bg-transparent indent-[-9999px]"
      onClick={(e) => {
        if (loading) return;
        e.stopPropagation();
        setEditing(true);
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }}
    >
      Edit
    </button>
  );
});

interface CancelButtonProps {
  show: boolean;
  disabled: boolean;
  abortPrompt: () => void;
}
const CancelButton = memo(({ show, disabled, abortPrompt }: CancelButtonProps) => {
  if (!show) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="absolute -top-10 right-1/2 z-10 translate-x-1/2 bg-background"
      onClick={(e) => {
        e.stopPropagation();
        abortPrompt();
      }}
      disabled={disabled}
    >
      <BackspaceIcon className="mr-1" /> Cancel generating
    </Button>
  );
});

interface AIUserMessageFormFooterProps {
  disabled: boolean;
  cancelDisabled: boolean;
  show: boolean;
  loading: boolean;
  waitingOnMessageIndex?: number;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  prompt: string;
  setPrompt: (prompt: React.SetStateAction<string>) => void;
  submitPrompt: (prompt: string) => void;
  abortPrompt: () => void;
  handleFiles: (files: FileList | File[]) => void;
  fileTypes: string[];
  handleClickMention: () => void;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  filesSupportedText: string;
  isAnalyst: boolean;
}
const AIUserMessageFormFooter = memo(
  ({
    disabled,
    cancelDisabled,
    show,
    loading,
    waitingOnMessageIndex,
    textareaRef,
    prompt,
    setPrompt,
    submitPrompt,
    abortPrompt,
    handleFiles,
    fileTypes,
    handleClickMention,
    context,
    setContext,
    filesSupportedText,
    isAnalyst,
  }: AIUserMessageFormFooterProps) => {
    const handleClickSubmit = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        submitPrompt(prompt);
      },
      [submitPrompt, prompt]
    );

    const disabledSubmit = useMemo(
      () => prompt.length === 0 || loading || waitingOnMessageIndex !== undefined,
      [prompt, loading, waitingOnMessageIndex]
    );

    if (!show) {
      return null;
    }

    return (
      <>
        <div
          className={cn(
            'flex w-full select-none items-center justify-between px-2 pb-1 text-xs @container',
            waitingOnMessageIndex !== undefined && 'pointer-events-none opacity-50'
          )}
        >
          <div className="flex items-center gap-1">
            <AIUserMessageFormAttachFileButton
              disabled={disabled}
              handleFiles={handleFiles}
              fileTypes={fileTypes}
              filesSupportedText={filesSupportedText}
            />
            {isAnalyst && (
              <AIUserMessageFormConnectionsButton
                disabled={disabled}
                context={context}
                setContext={setContext}
                textareaRef={textareaRef}
              />
            )}
            {isAnalyst && (
              <TooltipPopover label="Reference sheet data" fastMode={true}>
                <Button
                  size="icon-sm"
                  className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
                  variant="ghost"
                  disabled={disabled}
                  onClick={handleClickMention}
                >
                  <MentionIcon />
                </Button>
              </TooltipPopover>
            )}
            <AIUserMessageFormTuneMenu
              disabled={disabled}
              prompt={prompt}
              setPrompt={setPrompt}
              textareaRef={textareaRef}
            />
          </div>

          <div className="flex">
            <SelectAIModelMenu loading={loading} textareaRef={textareaRef} />
            <div className="flex items-center gap-3">
              <ConditionalWrapper
                condition={prompt.length !== 0}
                Wrapper={({ children }) => (
                  <TooltipPopover label="Submit" shortcut={`${KeyboardSymbols.Enter}`}>
                    {children as React.ReactElement}
                  </TooltipPopover>
                )}
              >
                <Button
                  size="icon-sm"
                  className="rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClickSubmit(e);
                  }}
                  disabled={disabledSubmit}
                >
                  <ArrowUpwardIcon />
                </Button>
              </ConditionalWrapper>
            </div>
          </div>
        </div>

        <CancelButton show={loading} disabled={cancelDisabled} abortPrompt={abortPrompt} />
      </>
    );
  }
);
