import { Box, ButtonBase, useTheme } from '@mui/material';
import { forwardRef } from 'react';

type Props = {
  icon?: JSX.Element;
  children: React.ReactNode;
  onClick?: () => void;
  style?: Object;
};

const BottomBarItem = ({ icon, onClick, style = {}, children }: Props) => {
  const theme = useTheme();
  const baseStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    fontFamily: 'inherit',
    fontSize: '.7rem',
  };
  const styles = { ...baseStyles, ...style };

  const inner = (
    <>
      {icon && icon} {children}
    </>
  );
  return onClick ? (
    <ButtonBase
      style={styles}
      onClick={onClick}
      sx={{
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      }}
    >
      {inner}
    </ButtonBase>
  ) : (
    <Box style={styles}>{inner}</Box>
  );
};

const ComponentWithForwardedRef = forwardRef((props: any, ref) => {
  const { icon, onClick, style, children, ...rest } = props;
  return (
    <div {...rest} ref={ref}>
      <BottomBarItem icon={icon} onClick={onClick} style={style}>
        {children}
      </BottomBarItem>
    </div>
  );
});

export default ComponentWithForwardedRef;
