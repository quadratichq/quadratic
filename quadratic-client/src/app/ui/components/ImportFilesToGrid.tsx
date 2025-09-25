import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import type { ImportFilesToGridContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo } from 'react';

interface ImportFilesToGridProps {
  content: ImportFilesToGridContent;
}
export const ImportFilesToGrid = memo(({ content }: ImportFilesToGridProps) => {
  return (
    <>
      {content.files.map((file, index) => (
        <ToolCardQuery
          key={`${index}-${file.fileName}-${file.loading}`}
          className="px-2"
          label={`Importing ${file.fileName}...`}
          isLoading={file.loading}
        />
      ))}
    </>
  );
});
