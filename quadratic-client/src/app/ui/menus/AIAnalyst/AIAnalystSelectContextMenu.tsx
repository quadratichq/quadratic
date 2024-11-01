import { aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Context } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilValue } from 'recoil';

type AIAnalystSelectContextMenuProps = {
  context: Context;
  setContext: React.Dispatch<React.SetStateAction<Context>>;
  disabled: boolean;
  onClose: () => void;
};

export function AIAnalystSelectContextMenu({
  context,
  setContext,
  disabled,
  onClose,
}: AIAnalystSelectContextMenuProps) {
  const loading = useRecoilValue(aiAnalystLoadingAtom);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || loading}>
        <span>{'[+]'}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        alignOffset={-4}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <DropdownMenuCheckboxItem key={'sheet'} onCheckedChange={() => window.alert('TODO(ayush): add sheets')}>
          <span>TODO(ayush): add sheets</span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
