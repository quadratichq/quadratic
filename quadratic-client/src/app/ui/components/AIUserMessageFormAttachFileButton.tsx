import { uploadFile } from '@/app/helpers/files';
import { AttachFileIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useCallback } from 'react';

interface AIUserMessageFormAttachFileButtonProps {
  disabled: boolean;
  handleFiles: (files: FileList | File[]) => void;
  fileTypes: string[];
  filesSupportedText: string;
}
export const AIUserMessageFormAttachFileButton = memo(
  ({ disabled, handleFiles, fileTypes, filesSupportedText }: AIUserMessageFormAttachFileButtonProps) => {
    const handleUploadFiles = useCallback(async () => {
      trackEvent('[AIAttachFile].click');
      const files = await uploadFile(fileTypes);
      handleFiles(files);
    }, [handleFiles, fileTypes]);

    if (fileTypes.length === 0) {
      return null;
    }

    return (
      <div className="-ml-1">
        <TooltipPopover label={`Add ${filesSupportedText}`} fastMode={true}>
          <Button
            size="icon-sm"
            className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
            variant="ghost"
            disabled={disabled}
            onClick={handleUploadFiles}
          >
            <AttachFileIcon className="" />
          </Button>
        </TooltipPopover>
      </div>
    );
  }
);
