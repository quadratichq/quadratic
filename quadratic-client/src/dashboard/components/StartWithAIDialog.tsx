import { AIIcon, DatabaseIcon, ExamplesIcon, FileIcon, WebBrowserIcon } from '@/shared/components/Icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';

interface StartWithAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (option: string) => void;
}

const dataSourceOptions = [
  { value: 'file', label: 'File', icon: <FileIcon size="lg" className="text-primary" /> },
  { value: 'database', label: 'Database', icon: <DatabaseIcon size="lg" className="text-primary" /> },
  { value: 'web', label: 'Web', icon: <WebBrowserIcon size="lg" className="text-primary" /> },
  { value: 'template', label: 'From a template', icon: <ExamplesIcon size="lg" className="text-primary" /> },
  { value: 'other', label: 'From an AI message', icon: <AIIcon size="lg" className="text-primary" /> },
];

export function StartWithAIDialog({ open, onOpenChange, onSelect }: StartWithAIDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">What data are you trying to analyze?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-4">
          <div className="grid grid-cols-3 gap-2">
            {dataSourceOptions.slice(0, 3).map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSelect(option.value);
                  onOpenChange(false);
                }}
                className="group relative aspect-square select-none rounded-lg border border-border px-3 py-4 font-medium shadow-sm hover:border-primary hover:shadow-md active:bg-accent"
              >
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  {option.icon}
                  <span className="relative flex items-center">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {dataSourceOptions.slice(3).map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSelect(option.value);
                  onOpenChange(false);
                }}
                className="group relative aspect-square select-none rounded-lg border border-border px-3 py-4 font-medium shadow-sm hover:border-primary hover:shadow-md active:bg-accent"
              >
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  {option.icon}
                  <span className="relative flex items-center">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
