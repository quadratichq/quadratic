import QuadraticUI from './QuadraticUI';
import { FileProvider } from './components/FileProvider';

export default function QuadraticUIContext() {
  return (
    <FileProvider>
      <QuadraticUI />
    </FileProvider>
  );
}
