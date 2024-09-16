import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { FormattingBar } from '@/app/ui/menus/Toolbar/FormattingBar';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';
import { useRecoilValue } from 'recoil';

export const Toolbar = () => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { permissions } = editorInteractionState;

  return (
    <div className="flex h-8 flex-shrink-0 select-none justify-between border-b border-border">
      <div className="w-24 flex-shrink-0 border-r border-border md:w-40">
        <CursorPosition />
      </div>
      <div className="no-scrollbar flex flex-grow items-stretch overflow-auto lg:justify-center">
        {permissions.includes('FILE_EDIT') && <FormattingBar />}
      </div>
      <div className="flex items-center justify-end lg:w-40">
        <ZoomMenu />
      </div>
    </div>
  );
};
