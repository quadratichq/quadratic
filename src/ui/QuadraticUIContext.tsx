import QuadraticUI from './QuadraticUI';
import { FileProvider } from './components/FileProvider';

export default function QuadraticUIContext({ initialFileData }: any) {
  return (
    <FileProvider initialFileData={initialFileData}>
      <QuadraticUI />
    </FileProvider>
  );
}
