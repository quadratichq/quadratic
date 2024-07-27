import { FileProvider } from '@/app/ui/components/FileProvider';
import QuadraticUI from '@/app/ui/QuadraticUI';

export default function QuadraticUIContext() {
  return (
    <FileProvider>
      <QuadraticUI />
    </FileProvider>
  );
}
