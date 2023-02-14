import { Tooltip } from '@mui/material';

export const TooltipHint = ({
  title,
  shortcut,
  children,
}: {
  title: string;
  shortcut?: string;
  children: JSX.Element;
}) => {
  return (
    <Tooltip
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
