import { filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { Progress } from '@/shared/shadcn/ui/progress';
import { useRecoilValue } from 'recoil';

// The last message.total + 1 is used to track the execute operation progress.

export const ImportProgress = () => {
  const { importing, files, currentFileIndex } = useRecoilValue(filesImportProgressAtom);

  if (!importing) return;

  return (
    <div
      style={{
        position: 'absolute',
        left: '2rem',
        bottom: '1rem',
        zIndex: 10,
        background: 'white',
        border: '1px solid black',
        padding: '1rem',
        minWidth: '300px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>Importing {files[currentFileIndex].name}...</div>
      <Progress value={files[currentFileIndex].progress ?? 0} />
    </div>
  );
};
