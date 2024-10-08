import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';

interface Props {
  id: string;
  title: string;
  children: ReactNode;
  open: boolean;
  toggleOpen: () => void;
  height: number;
}

// Calculates the height of the minimized box by creating the same element and
// measuring its height.
export const calculatePanelBoxMinimizedSize = () => {
  const div = document.createElement('div');
  div.className = 'px-2 pb-2 pt-2 text-sm';
  div.innerHTML = 'Test';
  document.body.appendChild(div);
  const height = div.getBoundingClientRect().height;
  document.body.removeChild(div);
  return height;
};

export const PanelBox = (props: Props) => {
  const { title, children, open, toggleOpen, height, id } = props;

  return (
    <div id={id} className={`relative flex flex-col overflow-auto`} style={{ height }}>
      <Button variant="ghost" onClick={toggleOpen} className="p-0 hover:bg-transparent">
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
      {open && <div className={'h-full overflow-hidden'}>{children}</div>}
    </div>
  );
};
