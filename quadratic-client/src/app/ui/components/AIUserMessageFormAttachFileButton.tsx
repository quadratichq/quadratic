import { uploadFile } from '@/app/helpers/files';
import { useDataPicker } from '@/shared/components/DataPicker';
import { AttachFileIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
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
    const fileData = useFileRouteLoaderData();
    const teamUuid = fileData?.team?.uuid;
    const { open: openDataPicker } = useDataPicker();

    // Fallback to local file picker when no team UUID
    const handleUploadFromComputer = useCallback(async () => {
      const files = await uploadFile(fileTypes);
      if (files.length > 0) {
        const fileExtensions = files.map((file) => file.name.split('.').pop()?.toLowerCase() ?? 'unknown');
        trackEvent('[AIAttachFile].click', { fileTypes: fileExtensions, source: 'computer' });
      }
      handleFiles(files);
    }, [handleFiles, fileTypes]);

    // Open Data Center picker (user can upload within the picker)
    const handleOpenDataCenter = useCallback(async () => {
      if (!teamUuid) return;

      trackEvent('[AIAttachFile].click', { source: 'dataCenter' });

      const result = await openDataPicker(teamUuid, {
        title: 'Attach data',
        allowUpload: true,
        downloadContent: true,
      });

      if (result?.fileContent) {
        // Convert ArrayBuffer to File
        const file = new File([result.fileContent.data], result.fileContent.name, {
          type: result.fileContent.mimeType,
        });
        handleFiles([file]);
      }
    }, [teamUuid, openDataPicker, handleFiles]);

    if (fileTypes.length === 0) {
      return null;
    }

    // If no team UUID (shouldn't happen in normal flow), fallback to local file picker
    const handleClick = teamUuid ? handleOpenDataCenter : handleUploadFromComputer;

    return (
      <div className="-ml-1">
        <TooltipPopover label={`Add ${filesSupportedText}`} fastMode={true}>
          <Button
            size="icon-sm"
            className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
            variant="ghost"
            disabled={disabled}
            onClick={handleClick}
          >
            <AttachFileIcon />
          </Button>
        </TooltipPopover>
      </div>
    );
  }
);
