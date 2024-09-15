import { codeEditorEditorContentAtom, codeEditorModifiedEditorContentAtom } from '@/app/atoms/codeEditorAtom';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { ThumbDownOutlined, ThumbUpOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export const CodeEditorDiffButton = () => {
  const setEditorContent = useSetRecoilState(codeEditorEditorContentAtom);
  const [modifiedEditorContent, setModifiedEditorContent] = useRecoilState(codeEditorModifiedEditorContentAtom);

  const handleDiffReject = useCallback(() => {
    setModifiedEditorContent(undefined);
  }, [setModifiedEditorContent]);

  const handleDiffAccept = useCallback(() => {
    setEditorContent(modifiedEditorContent);
    setModifiedEditorContent(undefined);
  }, [modifiedEditorContent, setEditorContent, setModifiedEditorContent]);
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
