import { uploadFile } from '@/app/helpers/files';
import { AttachFileIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { memo, useCallback, useMemo } from 'react';

type Props = {
  disabled: boolean;
  handleFiles: (files: FileList | File[]) => void;
  fileTypes: string[];
};

export const AIUserMessageFormAttachFileButton = memo(({ disabled, handleFiles, fileTypes }: Props) => {
  const handleUploadFiles = useCallback(async () => {
    const files = await uploadFile(fileTypes);
    handleFiles(files);
  }, [handleFiles, fileTypes]);

  const label = useMemo(() => {
    const types = [];
    if (fileTypes.includes('.pdf')) {
      types.push('PDF');
    }
    if (fileTypes.includes('image/*')) {
      types.push('Image');
    }
    return types.join(', ');
  }, [fileTypes]);

  const tooltipLabel = useMemo(
    () =>
      fileTypes.includes('.pdf') && fileTypes.includes('image/*')
        ? 'Attach PDFs or images'
        : fileTypes.includes('.pdf')
          ? 'Attach PDFs'
          : fileTypes.includes('image/*')
            ? 'Attach image'
            : 'Files not supported by this model',
    [fileTypes]
  );

  if (fileTypes.length === 0) {
    return null;
  }

  return (
    <div className="cursor-pointer" onClick={handleUploadFiles}>
      <TooltipPopover label={tooltipLabel}>
        <div className="flex items-center">
          <Button
            size="icon-sm"
            className="-ml-1 h-7 w-7 rounded-full px-0 shadow-none"
            variant="ghost"
            disabled={disabled}
          >
            <AttachFileIcon className="" />
          </Button>

          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </TooltipPopover>
    </div>
  );
});
