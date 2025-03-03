import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { FormattingBar } from '@/app/ui/menus/Toolbar/FormattingBar';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';
import { useRecoilValue } from 'recoil';

export const Toolbar = () => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);

  return (
    <div className="hidden h-8 flex-shrink-0 select-none justify-between border-b border-border md:flex">
      <div className="w-48 border-r border-border xl:w-64 2xl:w-80">
        <CursorPosition />
      </div>
      <div className="no-scrollbar flex flex-grow items-stretch overflow-y-hidden overflow-x-scroll xl:justify-center">
        {permissions.includes('FILE_EDIT') && <FormattingBar />}
      </div>
      <div className="flex items-center justify-end xl:w-64 2xl:w-80">
        <ZoomMenu />
      </div>
    </div>
  );
};
