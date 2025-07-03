import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import { IframeIndexeddb } from '@/app/ai/iframeAiChatFiles/IframeIndexeddb';
import { useIframeAIChatFiles } from '@/app/ai/iframeAiChatFiles/useIframeAIChatFiles';
import { getExtension } from '@/app/helpers/files';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { AIIcon, ArrowUpwardIcon, AttachFileIcon, CloseIcon, SpinnerIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { useUpdateQueryStringValueWithoutNavigation } from '@/shared/hooks/useUpdateQueryStringValueWithoutNavigation';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

export const Component = () => {
  const {
    activeTeam: {
      team: { uuid },
    },
  } = useDashboardRouteLoaderData();

  // TODO: wire this up to wherever we want to store it
  const [searchParams] = useSearchParams();
  const [isPrivate, setIsPrivate] = useState(searchParams.get('private') === 'true');
  useUpdateQueryStringValueWithoutNavigation('private', isPrivate ? 'true' : 'false');

  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatId = useMemo(() => crypto.randomUUID(), []);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { files, handleUploadFiles, handleDeleteFiles, dragging } = useIframeAIChatFiles(iframeRef, chatId);

  const handleSubmit = useCallback(() => {
    if (loading || !value.trim()) return;
    setLoading(true);
    window.location.href = ROUTES.CREATE_FILE(uuid, { prompt: value, chatId, private: isPrivate });
  }, [chatId, isPrivate, loading, uuid, value]);

  const disabled = useMemo(() => value.length === 0 || loading, [value, loading]);

  return (
    <div className="flex h-full flex-grow flex-col items-center">
      <div className="flex h-full w-full flex-grow flex-col items-center justify-center gap-4">
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <AIIcon className="text-primary" size="xl" />

          <h1 className="relative text-center text-lg font-medium">
            Drop files, ask a question, and I’ll help you analyze and visualize your data in a new sheet
          </h1>
        </div>

        <div className="relative w-full max-w-lg">
          <AIPromptForm disabled={disabled} onSubmit={handleSubmit}>
            <AIPromptFilesDropZone dragging={dragging} />

            <AIPromptContext
              pills={files.map((file) => ({
                label: file.name,
                subLabel: getExtension(file.name),
                handleRemove: () => handleDeleteFiles([file.fileId]),
              }))}
            />

            <AIPromptTextarea textareaRef={textareaRef} value={value} onChange={setValue} disabled={loading} />

            <AIPromptControls>
              <AIPromptControlAttachFile onClick={handleUploadFiles} />

              {/* <AIPromptControlConnections /> */}

              <SelectAIModelMenu loading={loading} textareaRef={textareaRef} />

              <AIPromptControlSubmit loading={loading} disabled={disabled} />
            </AIPromptControls>
          </AIPromptForm>

          <IframeIndexeddb iframeRef={iframeRef} />
        </div>
      </div>

      <div className="mt-auto flex text-sm font-medium">
        <Label className="flex items-center gap-2">
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} /> Create as a personal file
        </Label>
        {/* <RadioGroup
          className="ml-4 flex gap-4"
          value={isPrivate ? 'private' : 'public'}
          onValueChange={(value) => setIsPrivate(value === 'private')}
        >
          <Label htmlFor="public" className="flex items-center gap-1">
            <RadioGroupItem value="public" id="public" />
            Team file
          </Label>
          <Label htmlFor="private" className="flex items-center gap-1">
            <RadioGroupItem value="private" id="private" />
            Personal file
          </Label>
        </RadioGroup> */}
      </div>
    </div>
  );
};

/*
  Consider making this a presentational component, where everything it needs to
  render is passed in as props — then it can be used anywhere because it's different
  here vs. in the app.

  Functionality is controlled via props, and presentation is composable, e.g.

  <AIPrompt.Form ref={...} onSubmit={...} className="...">
    <AIPrompt.Context />
    <AIPrompt.Textarea ref={ref} />
    <AIPrompt.Controls>
      <AIPrompt.AttachFileButton className="..." />
      <AIPrompt.ConnectionsButton />
      <AIPrompt.ThinkButton /> // Optionally exclude in certain contexts?
      <AIPrompt.SubmitButton />
    </AIPrompt.Controls>
    <AIPrompt.Cancel /> // Cancel button
  </AIPrompt.Form>

*/

interface AIPromptFormProps {
  disabled: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}
const AIPromptForm = memo(({ disabled, onSubmit, children }: AIPromptFormProps) => {
  return (
    <form
      className="w-full rounded border border-border bg-accent p-2 shadow-sm has-[textarea:focus]:border-primary has-[textarea:focus]:ring-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
    >
      {children}

      {/* <CancelButton
          show={loading || waitingOnMessageIndex !== undefined}
          waitingOnMessageIndex={waitingOnMessageIndex}
          abortPrompt={abortPrompt}
        /> */}
    </form>
  );
});

interface AIPromptFilesDropZoneProps {
  dragging: boolean;
}
const AIPromptFilesDropZone = memo(({ dragging }: AIPromptFilesDropZoneProps) => {
  if (!dragging) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-blue-50/95">
      <div className="text-center">
        <AttachFileIcon className="mx-auto mb-2 h-6 w-6 -rotate-45 text-blue-500" />

        <p className="text-lg font-semibold text-blue-700">Drop files here</p>

        <p className="text-sm text-blue-600">Image, PDF, Excel, CSV, or Parquet files</p>
      </div>

      <div className="absolute inset-2 z-10 flex items-center justify-center rounded-md border-4 border-dashed border-blue-600/20 bg-transparent"></div>
    </div>
  );
});

interface AIPromptControlsProps {
  children: React.ReactNode;
}
const AIPromptControls = memo(({ children }: AIPromptControlsProps) => {
  return (
    <div
      className={cn(
        'flex w-full select-none items-center justify-between'
        // waitingOnMessageIndex !== undefined && 'pointer-events-none opacity-50'
      )}
    >
      {/* <SelectAIModelMenu loading={loading} textareaRef={textareaRef} /> */}

      <div className="flex w-full items-center gap-1 text-xs text-muted-foreground">{children}</div>
    </div>
  );
});

interface AIPromptControlAttachFileProps {
  onClick: () => void;
}
const AIPromptControlAttachFile = memo(({ onClick }: AIPromptControlAttachFileProps) => {
  return (
    <TooltipPopover label="Attach file">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-full text-foreground"
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
      >
        <AttachFileIcon />
      </Button>
    </TooltipPopover>
  );
});

interface AIPromptContextProps {
  pills: Array<{ label: string; subLabel?: string; handleRemove: () => void }>;
}
const AIPromptContext = memo(({ pills }: AIPromptContextProps) => {
  return (
    <div className="flex flex-wrap gap-1 pb-1">
      {pills.map(({ label, subLabel, handleRemove }, i) => (
        <Badge key={`${i}-${label}-${subLabel}`} variant="outline">
          {label} {subLabel && <span className="ml-1 text-xs font-normal text-muted-foreground">{subLabel}</span>}
          <button
            type="button"
            className="-mr-1 ml-1 flex items-center rounded-full text-muted-foreground opacity-50 hover:opacity-100"
            onClick={handleRemove}
          >
            <CloseIcon size="xs" />
          </button>
        </Badge>
      ))}
    </div>
  );
});

interface AIPromptTextareaProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}
const AIPromptTextarea = memo(({ value, onChange, disabled, textareaRef }: AIPromptTextareaProps) => {
  return (
    <Textarea
      autoFocus={true}
      ref={textareaRef}
      // value={value}
      className={cn(
        // text-md dashboard, text-sm app?
        'text-md min-h-32 rounded-none border-none p-1 pb-0 shadow-none focus-visible:ring-0'
        // editing ? 'min-h-14' : 'pointer-events-none !max-h-none overflow-hidden'
        // (waitingOnMessageIndex !== undefined || showAIUsageExceeded) && 'pointer-events-none opacity-50'
      )}
      onChange={(e) => onChange(e.target.value)}
      // onKeyDown={handleKeyDown}
      autoComplete="off"
      placeholder={
        //waitingOnMessageIndex !== undefined ? 'Waiting to send message...' : 'Ask a question...'
        'Ask a question...'
      }
      autoHeight={true}
      maxHeight={'120px'}
      disabled={disabled}
    />
  );
});

// function AIPromptControlThinking() {
//   const [thinking, setThinking] = useState(false);
//   return thinking ? (
//     <Button
//       type="button"
//       variant="ghost"
//       size="sm"
//       className="h-8 rounded-full border-primary !bg-border pl-1.5 pr-2 !text-primary"
//       onClick={(e) => {
//         e.stopPropagation();
//         console.log('think', thinking);
//         setThinking(false);
//       }}
//     >
//       <LightbulbIcon /> Think
//     </Button>
//   ) : (
//     <TooltipPopover label="Think">
//       <Button
//         type="button"
//         variant="ghost"
//         size="sm"
//         className="h-8 w-8 rounded-full text-foreground"
//         onClick={(e) => {
//           e.stopPropagation();
//           setThinking(true);
//         }}
//       >
//         <LightbulbIcon />
//       </Button>
//     </TooltipPopover>
//   );
// }

// function AIPromptControlConnections() {
//   return (
//     <Popover>
//       <TooltipPopover label="Connections">
//         <PopoverTrigger asChild>
//           <Button type="button" variant="ghost" size="sm" className="h-8 w-8 rounded-full text-foreground">
//             <DatabaseIcon />
//           </Button>
//         </PopoverTrigger>
//       </TooltipPopover>
//       <PopoverContent className="w-64 text-xs" side="top" align="start">
//         <p className="font-medium">Chat with your connections, they're in context!</p>
//         <hr className="my-3" />
//         <ul className="flex flex-col gap-2">
//           <li className="flex items-center gap-1">
//             <LanguageIcon language="postgres" /> [Demo] Quadratic public data
//           </li>
//           <li className="flex items-center gap-1 text-muted-foreground">
//             <AddIcon size="sm" /> Add connection…
//           </li>
//         </ul>
//       </PopoverContent>
//     </Popover>
//   );
// }

interface AIPromptControlSubmitProps {
  loading: boolean;
  disabled: boolean;
}
const AIPromptControlSubmit = memo(({ loading, disabled }: AIPromptControlSubmitProps) => {
  return (
    <ConditionalWrapper
      condition={!disabled}
      Wrapper={({ children }) => (
        <TooltipPopover label="Submit" shortcut={KeyboardSymbols.Enter}>
          {children as React.ReactElement}
        </TooltipPopover>
      )}
    >
      <Button size="icon-sm" className="h-8 w-8 rounded-full" type="submit" disabled={disabled}>
        {loading ? <SpinnerIcon /> : <ArrowUpwardIcon />}
      </Button>
    </ConditionalWrapper>
  );
});
