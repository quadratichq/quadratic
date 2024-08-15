import { fileImportProgressSelector } from '@/dashboard/atoms/fileImportProgressAtom';
import { Progress } from '@/shared/shadcn/ui/progress';
import { useRecoilValue } from 'recoil';

// The last message.total + 1 is used to track the execute operation progress.

export const ImportProgress = () => {
  const { fileName, importing, totalProgress } = useRecoilValue(fileImportProgressSelector);

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
      <div style={{ marginBottom: '1rem' }}>Importing {fileName}...</div>
      <Progress value={totalProgress} />
    </div>
  );
};
