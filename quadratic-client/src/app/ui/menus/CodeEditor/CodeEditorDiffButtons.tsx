import {
  codeEditorCodeCellAtom,
  codeEditorCodeStringAtom,
  codeEditorDiffEditorContentAtom,
  codeEditorEditorContentAtom,
  codeEditorShowDiffEditorAtom,
} from '@/app/atoms/codeEditorAtom';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ThumbDownIcon, ThumbUpIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { useRecoilCallback, useRecoilValue } from 'recoil';

export const CodeEditorDiffButtons = () => {
  const showDiffEditor = useRecoilValue(codeEditorShowDiffEditorAtom);

  const handleDiffReject = useRecoilCallback(
    ({ set, snapshot }) =>
      async () => {
        const diffEditorContent = await snapshot.getPromise(codeEditorDiffEditorContentAtom);
        if (!diffEditorContent) return;

        if (diffEditorContent.isApplied) {
          set(codeEditorCodeStringAtom, diffEditorContent.editorContent);
          set(codeEditorEditorContentAtom, diffEditorContent.editorContent);

          const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
          quadraticCore.setCodeCellValue({
            sheetId: codeCell.sheetId,
            x: codeCell.pos.x,
            y: codeCell.pos.y,
            codeString: diffEditorContent.editorContent ?? '',
            language: codeCell.language,
          });
        } else {
          set(codeEditorDiffEditorContentAtom, undefined);
        }
      },
    []
  );

  const handleDiffAccept = useRecoilCallback(
    ({ set, snapshot }) =>
      async () => {
        const diffEditorContent = await snapshot.getPromise(codeEditorDiffEditorContentAtom);
        if (!diffEditorContent) return;

        if (!diffEditorContent.isApplied) {
          set(codeEditorCodeStringAtom, diffEditorContent.editorContent);
          set(codeEditorEditorContentAtom, diffEditorContent.editorContent);

          const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
          quadraticCore.setCodeCellValue({
            sheetId: codeCell.sheetId,
            x: codeCell.pos.x,
            y: codeCell.pos.y,
            codeString: diffEditorContent.editorContent ?? '',
            language: codeCell.language,
          });
        } else {
          set(codeEditorDiffEditorContentAtom, undefined);
        }
      },
    []
  );

  if (!showDiffEditor) return null;

  return (
    <div className="code-editor-diff-button grid grid-cols-2 items-center gap-2 px-2 pb-2 text-foreground">
      <Button onClick={handleDiffReject} variant="destructive" size="sm">
        <ThumbDownIcon className="mr-1" /> Reject
      </Button>

      <Button onClick={handleDiffAccept} variant="success" size="sm">
        <ThumbUpIcon className="mr-1" /> Accept
      </Button>
    </div>
  );
};
