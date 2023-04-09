import { Tooltip } from '@mui/material';

interface TooltipHintProps {
  title: string;
  shortcut?: string;
  children: JSX.Element;
  // Anything else for <Tooltip> you want to pass
  [x: string]: any;
}

export const TooltipHint = ({ title, shortcut, children, ...rest }: TooltipHintProps) => {
  return (
    <Tooltip
      {...rest}
      arrow
      placement="top"
      title={
        <>
          {title} {shortcut && <span style={{ opacity: '.625' }}>({shortcut})</span>}
        </>
      }
      disableInteractive
    >
      {children}
    </Tooltip>
  );
};
