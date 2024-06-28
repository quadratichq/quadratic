import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { ChevronRightIcon } from '@radix-ui/react-icons';

interface Props {
  id: string;
  title: string;
  children: JSX.Element | JSX.Element[];
  index: number;
  codeEditorPanelData: CodeEditorPanelData;
}

export function PanelBox(props: Props) {
  const { title, children, index, codeEditorPanelData, id } = props;
  const height = codeEditorPanelData.panelHeightPercentages[index];
  const open = !codeEditorPanelData.panelHidden[index];
  const setOpen = () => {
    codeEditorPanelData.setPanelHidden((prevState) => prevState.map((val, i) => (i === index ? !val : val)));
  };

  return (
    <div
      id={id}
      className={`relative flex flex-col overflow-scroll ${open ? 'h-full grow' : 'shrink'}`}
      style={{ flexBasis: open ? `${height}%` : 'auto' }}
    >
      <Button variant={'ghost'} onClick={setOpen} className="p-0">
        <div className={'flex w-full items-center px-2 pb-2 pt-2'}>
          <ChevronRightIcon
            className={cn(
              'mr-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open ? 'rotate-90' : ''
            )}
          />
          {title}
        </div>
      </Button>
      <div className={cn('grow overflow-scroll', open ? 'block' : 'hidden')}>{children}</div>
    </div>
  );
}
