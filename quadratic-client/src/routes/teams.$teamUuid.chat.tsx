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
import { useState } from 'react';
import { useSearchParams } from 'react-router';

export const Component = () => {
  const {
    activeTeam: {
      team: { uuid },
    },
  } = useDashboardRouteLoaderData();
  const [searchParams] = useSearchParams();

  // TODO: wire this up to wheverever we want to store it
  const [isPrivate, setIsPrivate] = useState(searchParams.get('private') === 'true');
  const [value, setValue] = useState('');
  const [contexts, setContexts] = useState<Array<{ id: string; label: string; sublabel?: string }>>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  useUpdateQueryStringValueWithoutNavigation('private', isPrivate ? 'true' : 'false');

  // TODO: drag and drop on screen

  // TODO: wire all these up
  const onSubmit = async () => {
    setLoadState('loading');

    // TODO: handle file uploads, either here or in router action
    await new Promise((resolve) => setTimeout(resolve, 2000));

    window.location.href = ROUTES.CREATE_FILE(uuid, { prompt: value, private: isPrivate });
    // setLoadState('idle');
  };
  const handleAttachFile = () => {
    setContexts((prev) => [
      ...prev,
      { id: new Date().toISOString(), label: `my_file_name_${prev.length + 1}.pdf`, sublabel: 'PDF' },
    ]);
  };

  const disabled = value.length === 0 || loadState !== 'idle';

  return (
    <div className="flex h-full flex-grow flex-col items-center">
      <div className="flex h-full w-full flex-grow flex-col items-center justify-center gap-4">
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <AIIcon className="text-primary" size="xl" />
          <h1 className="relative text-center text-lg font-medium">
            Drop files, ask a question, and I’ll help you analyze and visualize your data in a new sheet
          </h1>
        </div>
        <div className="w-full max-w-lg">
          <AIPromptForm onSubmit={onSubmit} disabled={disabled}>
            <AIPromptContext
              pills={contexts.map((c) => ({
                ...c,
                handleRemove: () => setContexts((prev) => prev.filter((prevItem) => prevItem.id !== c.id)),
              }))}
            />
            <AIPromptTextarea value={value} onChange={setValue} disabled={loadState !== 'idle'} />
            <AIPromptControls>
              <AIPromptControlAttachFile onClick={handleAttachFile} />
              {/* <AIPromptControlConnections /> */}
              {/* <AIPromptControlThinking /> */}
              <AIPromptControlModel />
              <AIPromptControlSubmit disabled={disabled} isLoading={loadState === 'loading'} />
            </AIPromptControls>
          </AIPromptForm>
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
function AIPromptForm({ onSubmit, children }: any) {
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
}

function AIPromptControls({ children }: { children: React.ReactNode }) {
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
}

// Maybe we just skip this? Let the app decide how it will submit the prompt when they get into the file...
function AIPromptControlModel() {
  return <div className="ml-auto">Model</div>;
}

function AIPromptControlAttachFile({ onClick }: { onClick: () => void }) {
  return (
    <TooltipPopover label="Attach file">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-full text-foreground"
        onClick={onClick}
      >
        <AttachFileIcon />
      </Button>
    </TooltipPopover>
  );
}

function AIPromptContext({ pills }: { pills: Array<{ label: string; sublabel?: string; handleRemove?: () => void }> }) {
  return (
    <div className="flex flex-wrap gap-1 pb-1">
      {pills.map(({ label, sublabel, handleRemove }, i) => (
        <Badge key={i} variant="outline">
          {label} {sublabel && <span className="ml-1 text-xs font-normal text-muted-foreground">{sublabel}</span>}
          {handleRemove && (
            <button
              type="button"
              className="-mr-1 ml-1 flex items-center rounded-full text-muted-foreground opacity-50 hover:opacity-100"
              onClick={handleRemove}
            >
              <CloseIcon size="xs" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}

function AIPromptTextarea({ value, onChange, ref, disabled }: any) {
  return (
    <Textarea
      autoFocus={true}
      ref={ref}
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
}

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

function AIPromptControlSubmit({ disabled, isLoading }: { disabled: boolean; isLoading: boolean }) {
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
        {isLoading ? <SpinnerIcon /> : <ArrowUpwardIcon />}
      </Button>
    </ConditionalWrapper>
  );
}
