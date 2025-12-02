import { cn } from '@/shared/shadcn/utils';
import type { JSX } from 'react';
import { forwardRef } from 'react';

type Props = {
  icon?: JSX.Element;
  children: React.ReactNode;
  onClick?: () => void;
  style?: Object;
  className?: string;
};

const BottomBarItem = ({ icon, onClick, style = {}, children, className }: Props) => {
  const classNames = cn('flex items-center gap-0.5 py-1 px-2 text-xs', onClick && 'hover:bg-accent', className);
  const inner = (
    <>
      {icon && icon} {children}
    </>
  );
  return onClick ? (
    <button className={classNames} onClick={onClick} type="button">
      {inner}
    </button>
  ) : (
    <div className={classNames}>{inner}</div>
  );
};

const ComponentWithForwardedRef = forwardRef((props: any, ref) => {
  const { icon, onClick, style, children, className, ...rest } = props;
  return (
    <div {...rest} ref={ref}>
      <BottomBarItem icon={icon} onClick={onClick} style={style} className={className}>
        {children}
      </BottomBarItem>
    </div>
  );
});

export default ComponentWithForwardedRef;
