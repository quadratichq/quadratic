import SvgIcon, { SvgIconProps } from '@mui/material/SvgIcon';

// Built on doc guidance from material UI:
// https://mui.com/material-ui/icons/
//
// Icons designed originally on 24 x 24px artboard. Figma file:
// https://www.figma.com/file/HdhrQ6vUZH4quMl7WFX6Vd/Custom-Icons?node-id=0%3A1&t=t5GeoagkcP0W7hK2-1
//
// Contents must be manually copy/pasted from exported .svg files.
// Probably could make this better in the future by using something like:
// https://github.com/gregberge/svgr

export const BorderDashed = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M4 13V11H8V13H4Z" />
    <path d="M10 13V11H14V13H10Z" />
    <path d="M16 13V11H20V13H16Z" />
  </SvgIcon>
);

export const BorderDotted = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 13V11H5V13H3Z" />
    <path d="M7 13V11H9V13H7Z" />
    <path d="M11 13V11H13V13H11Z" />
    <path d="M15 13V11H17V13H15Z" />
    <path d="M19 13V11H21V13H19Z" />
  </SvgIcon>
);

export const BorderDouble = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 11V10H21V11H3Z" />
    <path d="M3 13V12H21V13H3Z" />
  </SvgIcon>
);

export const BorderThin = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 13V11H21V13H3Z" />
  </SvgIcon>
);

export const BorderMedium = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 14V10H21V14H3Z" />
  </SvgIcon>
);

export const BorderThick = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 15V9H21V15H3Z" />
  </SvgIcon>
);
