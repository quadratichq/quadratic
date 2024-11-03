import {
  codeEditorCodeCellAtom,
  codeEditorDiffEditorContentAtom,
  codeEditorEditorContentAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { ThumbDownOutlined, ThumbUpOutlined } from '@mui/icons-material';
import { useRecoilCallback } from 'recoil';

export const CodeEditorDiffButtons = () => {
  const handleDiffReject = useRecoilCallback(
    ({ set, snapshot }) =>
      async () => {
        const diffEditorContent = await snapshot.getPromise(codeEditorDiffEditorContentAtom);
        if (!diffEditorContent) return;

        if (diffEditorContent.isApplied) {
          set(codeEditorEditorContentAtom, diffEditorContent.editorContent);

          const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
          quadraticCore.setCodeCellValue({
            sheetId: codeCell.sheetId,
            x: codeCell.pos.x,
            y: codeCell.pos.y,
            codeString: diffEditorContent.editorContent ?? '',
            language: codeCell.language,
            cursor: sheets.getCursorPosition(),
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
          set(codeEditorEditorContentAtom, diffEditorContent.editorContent);

          const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
          quadraticCore.setCodeCellValue({
            sheetId: codeCell.sheetId,
            x: codeCell.pos.x,
            y: codeCell.pos.y,
            codeString: diffEditorContent.editorContent ?? '',
            language: codeCell.language,
            cursor: sheets.getCursorPosition(),
          });
        } else {
          set(codeEditorDiffEditorContentAtom, undefined);
        }
      },
    []
  );

  return (
    <div className="code-editor-diff-button flex items-center">
      <TooltipPopover label={'Reject'} side="bottom">
        <Button onClick={handleDiffReject} size="icon-sm" variant="ghost">
          <ThumbDownOutlined fontSize="small" color="error" />
        </Button>
      </TooltipPopover>

      <TooltipPopover label={'Accept'} side="bottom">
        <Button onClick={handleDiffAccept} size="icon-sm" variant="ghost">
          <ThumbUpOutlined fontSize="small" color="success" />
        </Button>
      </TooltipPopover>
    </div>
  );
};
