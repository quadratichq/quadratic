import {
  codeEditorCodeCellAtom,
  codeEditorDiffEditorContentAtom,
  codeEditorEditorContentAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ThumbDownOutlined, ThumbUpOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useRecoilCallback } from 'recoil';

export const CodeEditorDiffButtons = () => {
  const handleDiffReject = useRecoilCallback(
    ({ set, snapshot }) =>
      async () => {
        const diffEditorContent = await snapshot.getPromise(codeEditorDiffEditorContentAtom);
        if (!diffEditorContent) return;

        if (diffEditorContent.isApplied) {
          const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);

          quadraticCore.setCodeCellValue({
            sheetId: codeCell.sheetId,
            x: codeCell.pos.x,
            y: codeCell.pos.y,
            codeString: diffEditorContent.editorContent ?? '',
            language: codeCell.language,
            cursor: sheets.getCursorPosition(),
          });

          set(codeEditorEditorContentAtom, diffEditorContent.editorContent);
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
        } else {
          set(codeEditorDiffEditorContentAtom, undefined);
        }
      },
    []
  );

  return (
    <div className="code-editor-diff-button flex items-center">
      <TooltipHint title={'Reject'} placement="bottom">
        <span>
          <IconButton size="small" color="error" onClick={handleDiffReject}>
            <ThumbDownOutlined fontSize="small" />
          </IconButton>
        </span>
      </TooltipHint>

      <TooltipHint title={'Accept'} placement="bottom">
        <span>
          <IconButton size="small" color="success" onClick={handleDiffAccept}>
            <ThumbUpOutlined fontSize="small" />
          </IconButton>
        </span>
      </TooltipHint>
    </div>
  );
};
