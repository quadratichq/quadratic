import { Events } from '@/app/gridGL/Events';
import { PixiAppEffects } from '@/app/gridGL/PixiAppEffects';
import { FileProvider } from '@/app/ui/components/FileProvider';
import QuadraticUI from '@/app/ui/QuadraticUI';
import { TooltipProvider } from '@/shared/shadcn/ui/tooltip';

export default function QuadraticUIContext() {
  return (
    <FileProvider>
      <TooltipProvider skipDelayDuration={0} delayDuration={700}>
        <QuadraticUI />
        <PixiAppEffects />
        <Events />
      </TooltipProvider>
    </FileProvider>
  );
}
