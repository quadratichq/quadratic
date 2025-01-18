import { useAIMode } from '@/app/ai/hooks/useAIMode';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { CaretDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';

interface SelectAIModeMenuProps {
  loading: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
}

const MODE_OPTIONS = {
  chat: {
    displayName: 'Chat mode',
    prefix: '',
  },
  planning: {
    displayName: 'Planning mode',
    prefix: "Let me know the steps you're going to take before executing them.",
  },
} as const;

export function SelectAIModeMenu({ loading, textAreaRef }: SelectAIModeMenuProps) {
  const [selectedMode, setSelectedMode] = useAIMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading}
        className={cn(`flex items-center text-xs text-muted-foreground`, !loading && 'hover:text-foreground')}
      >
        {MODE_OPTIONS[selectedMode].displayName}
        <CaretDownIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        alignOffset={-4}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          textAreaRef.current?.focus();
        }}
      >
        {(Object.keys(MODE_OPTIONS) as (keyof typeof MODE_OPTIONS)[]).map((mode) => (
          <DropdownMenuCheckboxItem
            key={mode}
            checked={selectedMode === mode}
            onCheckedChange={() => {
              mixpanel.track('[AI].mode.change', { mode });
              setSelectedMode(mode);
            }}
          >
            <div className="flex w-full items-center justify-between text-xs">
              <span className="pr-4">{MODE_OPTIONS[mode].displayName}</span>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
