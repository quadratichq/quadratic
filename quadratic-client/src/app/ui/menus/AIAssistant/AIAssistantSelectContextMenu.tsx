import { aiAssistantContextAtom, aiAssistantLoadingAtom } from '@/app/atoms/aiAssistantAtom';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useRecoilState, useRecoilValue } from 'recoil';

export function AIAssistantContextModelMenu() {
  const [context, setContext] = useRecoilState(aiAssistantContextAtom);
  const loading = useRecoilValue(aiAssistantLoadingAtom);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={loading}>
        <span>{'[...]'}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" alignOffset={-4}>
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
          disabled={true} // TODO: enable after implementing cursor selection
        >
          <span>Current sheet</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          key={'visible data'}
          checked={context.visibleData}
          onCheckedChange={() => setContext((prev) => ({ ...prev, visibleData: !prev.visibleData }))}
          disabled={true} // TODO: enable after implementing visible data
        >
          <span>Visible data</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          key={'cursor selection'}
          checked={context.cursorSelection}
          onCheckedChange={() => setContext((prev) => ({ ...prev, cursorSelection: !prev.cursorSelection }))}
        >
          <span>Cursor selection</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          key={'code cell'}
          checked={!!context.codeCell}
          onCheckedChange={() => setContext((prev) => ({ ...prev, codeCell: undefined }))}
        >
          <span>Code cell</span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
