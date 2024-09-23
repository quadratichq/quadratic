import { TooltipProvider } from '@/shared/shadcn/ui/tooltip';
import QuadraticUI from './QuadraticUI';
import { FileProvider } from './components/FileProvider';

export default function QuadraticUIContext() {
  return (
    <FileProvider>
      <TooltipProvider>
        <QuadraticUI />
      </TooltipProvider>
    </FileProvider>
  );
}
