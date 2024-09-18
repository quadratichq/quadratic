import { PixiAppSettings } from '@/app/gridGL/PixiAppSettings';
import { FileProvider } from '@/app/ui/components/FileProvider';
import QuadraticUI from '@/app/ui/QuadraticUI';
import { TooltipProvider } from '@/shared/shadcn/ui/tooltip';

export default function QuadraticUIContext() {
  return (
    <FileProvider>
      <TooltipProvider>
        <QuadraticUI />
        <PixiAppSettings />
      </TooltipProvider>
    </FileProvider>
  );
}
