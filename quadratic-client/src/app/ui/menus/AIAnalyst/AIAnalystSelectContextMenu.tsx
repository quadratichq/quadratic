import { aiAnalystLoadingAtom, aiAnalystShowInternalContextAtom } from '@/app/atoms/aiAnalystAtom';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Context } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilState, useRecoilValue } from 'recoil';

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
  const [showInternalContext, setShowInternalContext] = useRecoilState(aiAnalystShowInternalContextAtom);
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
        <DropdownMenuCheckboxItem
          key={'internal context'}
          checked={showInternalContext}
          onCheckedChange={() => setShowInternalContext((prev) => !prev)}
        >
          <span>Show internal context</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          key={'quadratic docs'}
          checked={context.quadraticDocs}
          onCheckedChange={() => setContext((prev) => ({ ...prev, quadraticDocs: !prev.quadraticDocs }))}
        >
          <span>Quadratic documentation</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          key={'connection'}
          checked={context.connections}
          onCheckedChange={() => setContext((prev) => ({ ...prev, connections: !prev.connections }))}
          disabled={true} // TODO: enable after implementing connections
        >
          <span>Connections</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          key={'all sheets'}
          checked={context.allSheets}
          onCheckedChange={() => setContext((prev) => ({ ...prev, allSheets: !prev.allSheets }))}
          disabled={true} // TODO: enable after implementing all sheets
        >
          <span>All sheets</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          key={'current sheet'}
          checked={context.currentSheet}
          onCheckedChange={() => setContext((prev) => ({ ...prev, currentSheet: !prev.currentSheet }))}
        >
          <span>Current sheet</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          key={'visible data'}
          checked={context.visibleData}
          onCheckedChange={() => setContext((prev) => ({ ...prev, visibleData: !prev.visibleData }))}
        >
          <span>Visible data</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          key={'selection'}
          checked={context.selection.length > 0}
          onCheckedChange={() => setContext((prev) => ({ ...prev, selection: [] }))}
          disabled={context.selection.length === 0}
        >
          <span>Selection</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          key={'code cell'}
          checked={!!context.codeCell}
          onCheckedChange={() => setContext((prev) => ({ ...prev, codeCell: undefined }))}
          disabled={!context.codeCell}
        >
          <span>Code cell</span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}