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

  const label = useMemo(() => (fileTypes.includes('.pdf') ? 'Attach image or PDF' : 'Attach image'), [fileTypes]);

  return (
    <TooltipPopover label={label}>
      <Button
        size="icon-sm"
        className="-ml-1 h-7 w-7 rounded-full px-0 shadow-none"
        variant="ghost"
        onClick={handleUploadFiles}
        disabled={disabled}
      >
        <AttachFileIcon className="" />
      </Button>
    </TooltipPopover>
  );
});
