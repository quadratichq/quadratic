import { ChevronLeftIcon, FileIcon } from '@/shared/components/Icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { useState, useRef, useCallback } from 'react';
import type { DragEvent } from 'react';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileSelect: (files: File[]) => void;
  onBack?: () => void;
  accept?: string;
}

export function FileUploadDialog({ open, onOpenChange, onFileSelect, onBack, accept }: FileUploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFileSelect(files);
        onOpenChange(false);
      }
    },
    [onFileSelect, onOpenChange]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(Array.from(files));
        onOpenChange(false);
      }
    },
    [onFileSelect, onOpenChange]
  );

  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {onBack && (
              <Button type="button" variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ChevronLeftIcon />
              </Button>
            )}
            <div className="flex-1">
              <DialogTitle className="text-center text-2xl font-bold">Upload your file</DialogTitle>
              <DialogDescription className="text-center">
                Drag and drop your file here, or click to select
              </DialogDescription>
            </div>
            {onBack && <div className="w-8"></div>}
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div
            className={cn(
              'relative flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
              isDragging ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4 p-8">
              <FileIcon size="lg" className="text-muted-foreground" />
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="text-lg font-medium">
                  {isDragging ? 'Drop file here' : 'Drag and drop your file here'}
                </span>
                <span className="text-sm text-muted-foreground">CSV, Excel, Parquet, or Grid files</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-border"></div>
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 border-t border-border"></div>
          </div>
          <Button type="button" variant="outline" onClick={handleSelectFileClick} className="w-full">
            <FileIcon className="mr-2" />
            Select a file
          </Button>
          <input ref={fileInputRef} type="file" hidden accept={accept} onChange={handleFileInputChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
