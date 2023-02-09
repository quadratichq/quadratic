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

export const DecimalIncrease = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="m18 22-1.4-1.4 1.575-1.6H12v-2h6.175L16.6 15.4 18 14l4 4ZM2 13v-3h3v3Zm7.5 0q-1.45 0-2.475-1.025Q6 10.95 6 9.5v-4q0-1.45 1.025-2.475Q8.05 2 9.5 2q1.45 0 2.475 1.025Q13 4.05 13 5.5v4q0 1.45-1.025 2.475Q10.95 13 9.5 13Zm9 0q-1.45 0-2.475-1.025Q15 10.95 15 9.5v-4q0-1.45 1.025-2.475Q17.05 2 18.5 2q1.45 0 2.475 1.025Q22 4.05 22 5.5v4q0 1.45-1.025 2.475Q19.95 13 18.5 13Zm-9-2q.625 0 1.062-.438Q11 10.125 11 9.5v-4q0-.625-.438-1.062Q10.125 4 9.5 4t-1.062.438Q8 4.875 8 5.5v4q0 .625.438 1.062Q8.875 11 9.5 11Zm9 0q.625 0 1.062-.438Q20 10.125 20 9.5v-4q0-.625-.438-1.062Q19.125 4 18.5 4t-1.062.438Q17 4.875 17 5.5v4q0 .625.438 1.062.437.438 1.062.438Z" />
  </SvgIcon>
);

export const DecimalDecrease = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="m16 22-4-4 4-4 1.4 1.4-1.575 1.6H22v2h-6.175l1.575 1.6ZM2 13v-3h3v3Zm7.5 0q-1.45 0-2.475-1.025Q6 10.95 6 9.5v-4q0-1.45 1.025-2.475Q8.05 2 9.5 2q1.45 0 2.475 1.025Q13 4.05 13 5.5v4q0 1.45-1.025 2.475Q10.95 13 9.5 13Zm0-2q.625 0 1.062-.438Q11 10.125 11 9.5v-4q0-.625-.438-1.062Q10.125 4 9.5 4t-1.062.438Q8 4.875 8 5.5v4q0 .625.438 1.062Q8.875 11 9.5 11Z" />
  </SvgIcon>
);

export const Icon123 = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M5.5 15v-4.5H4V9h3v6ZM9 15v-2.5q0-.425.288-.713.287-.287.712-.287h2v-1H9V9h3.5q.425 0 .713.287.287.288.287.713v1.5q0 .425-.287.712-.288.288-.713.288h-2v1h3V15Zm6 0v-1.5h3v-1h-2v-1h2v-1h-3V9h3.5q.425 0 .712.287.288.288.288.713v4q0 .425-.288.712-.287.288-.712.288Z" />
  </SvgIcon>
);
