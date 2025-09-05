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
        <Button
          size="icon-sm"
          className="-ml-1 h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
          variant="ghost"
          disabled={disabled}
        >
          <AttachFileIcon className="" />
        </Button>
      </TooltipPopover>
    </div>
  );
});
