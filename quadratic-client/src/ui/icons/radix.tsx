import React from 'react';

// Our extension of the Radix icons
// https://www.radix-ui.com/icons

// Built follow examples from radix icons:
// https://github.com/radix-ui/icons/blob/master/packages/radix-icons/src/AccessibilityIcon.tsx

// Icons designed originally on 15x15px artboard. Figma file:
// https://www.figma.com/file/xld8IGtKZvuQdf7MfOgGKI/Radix-Icons?type=design&node-id=0%3A1&mode=design&t=cDhBGQQ9cedOlFIP-1

// Contents are manually copy/pasted from Figma as .svg files

export interface IconProps extends React.SVGAttributes<SVGElement> {
  children?: never;
  color?: string;
}

export const BorderAll2Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1 0.25C0.585786 0.25 0.25 0.585786 0.25 1V14C0.25 14.4142 0.585786 14.75 1 14.75H14C14.4142 14.75 14.75 14.4142 14.75 14V1C14.75 0.585786 14.4142 0.25 14 0.25H1ZM1.75 6.75V1.75H6.75V6.75L1.75 6.75ZM1.75 8.25V13.25H6.75V8.25L1.75 8.25ZM8.25 13.25H13.25V8.25L8.25 8.25V13.25ZM13.25 6.75V1.75H8.25V6.75L13.25 6.75Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const BorderVerticalIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="13" y="5.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="3.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="7.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="5" y="7.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="5" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="5" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="3" y="7.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="3" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="3" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="9" y="7.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="9" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="9" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="11" y="7.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="11" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="11" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="9.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="11.025" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="5.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="3.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="7.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="9.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="11.025" width="1" height="1" rx="0.5" fill={color} />
        <path fillRule="evenodd" clipRule="evenodd" d="M6.75 14L6.75 1L8.25 1L8.25 14L6.75 14Z" fill={color} />
      </svg>
    );
  }
);

export const BorderInnerIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="13" y="5.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="3.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="5" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="5" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="3" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="3" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="9" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="9" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="11" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="11" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="9.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="11.025" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="5.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="3.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="9.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="11.025" width="1" height="1" rx="0.5" fill={color} />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6.75 8.25V14H8.25V8.25L14 8.25V6.75L8.25 6.75V1H6.75V6.75L1 6.75V8.25L6.75 8.25Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const BorderHorizontalIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="5.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="5.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="7" y="3.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="3.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="7" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="7" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="5" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="5" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="3" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="3" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="9" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="9" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="11" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="11" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="7" y="9.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="9.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="7" y="11.025" width="1" height="1" rx="0.5" fill={color} />
        <rect x="13" y="11.025" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="5.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="3.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="13.0254" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="1.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="9.02502" width="1" height="1" rx="0.5" fill={color} />
        <rect x="1" y="11.025" width="1" height="1" rx="0.5" fill={color} />
        <path fillRule="evenodd" clipRule="evenodd" d="M14 8.25L1 8.25L1 6.75L14 6.75L14 8.25Z" fill={color} />
      </svg>
    );
  }
);

export const FileDeleteIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3 2.5C3 2.22386 3.22386 2 3.5 2H8V5.5C8 5.77614 8.22386 6 8.5 6H12V7H13V5.5C13 5.36739 12.9473 5.24021 12.8536 5.14645L8.85355 1.14645C8.75979 1.05268 8.63261 1 8.5 1H3.5C2.67157 1 2 1.67157 2 2.5V12.5C2 13.3284 2.67157 14 3.5 14H7V13H3.5C3.22386 13 3 12.7761 3 12.5V2.5ZM11.2929 5L9 2.70711V5H11.2929Z"
          fill={color}
        />
        <path d="M9.25 11.5H13.75" stroke={color} strokeLinecap="round" />
      </svg>
    );
  }
);

export const FileDownloadIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3 2.5C3 2.22386 3.22386 2 3.5 2H8V5.5C8 5.77614 8.22386 6 8.5 6H12V7H13V5.5C13 5.36739 12.9473 5.24021 12.8536 5.14645L8.85355 1.14645C8.75979 1.05268 8.63261 1 8.5 1H3.5C2.67157 1 2 1.67157 2 2.5V12.5C2 13.3284 2.67157 14 3.5 14H7V13H3.5C3.22386 13 3 12.7761 3 12.5V2.5ZM11.2929 5L9 2.70711V5H11.2929Z"
          fill={color}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M11.5 9C11.7761 9 12 9.22386 12 9.5V13.2929L13.1464 12.1464C13.3417 11.9512 13.6583 11.9512 13.8536 12.1464C14.0488 12.3417 14.0488 12.6583 13.8536 12.8536L11.8536 14.8536C11.7598 14.9473 11.6326 15 11.5 15C11.3674 15 11.2402 14.9473 11.1464 14.8536L9.14645 12.8536C8.95118 12.6583 8.95118 12.3417 9.14645 12.1464C9.34171 11.9512 9.65829 11.9512 9.85355 12.1464L11 13.2929V9.5C11 9.22386 11.2239 9 11.5 9Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const FileDuplicateIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3 2.5C3 2.22386 3.22386 2 3.5 2H8V5.5C8 5.77614 8.22386 6 8.5 6H12V7H13V5.5C13 5.36739 12.9473 5.24021 12.8536 5.14645L8.85355 1.14645C8.75979 1.05268 8.63261 1 8.5 1H3.5C2.67157 1 2 1.67157 2 2.5V12.5C2 13.3284 2.67157 14 3.5 14H7V13H3.5C3.22386 13 3 12.7761 3 12.5V2.5ZM11.2929 5L9 2.70711V5H11.2929Z"
          fill={color}
        />
        <path d="M9.25 11.5H13.75" stroke={color} strokeLinecap="round" />
        <path d="M11.5 13.75V9.25" stroke={color} strokeLinecap="round" />
      </svg>
    );
  }
);

export const SheetIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4 4H1.5C1.22386 4 1 4.22386 1 4.5V6H4V4ZM5 4V6H14V4.5C14 4.22386 13.7761 4 13.5 4H5ZM4 7H1V10.5C1 10.7761 1.22386 11 1.5 11H4V7ZM5 11V7H14V10.5C14 10.7761 13.7761 11 13.5 11H5ZM1.5 3C0.671573 3 0 3.67157 0 4.5V10.5C0 11.3284 0.671573 12 1.5 12H13.5C14.3284 12 15 11.3284 15 10.5V4.5C15 3.67157 14.3284 3 13.5 3H1.5Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const SheetDeleteIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1.5 4H13.5C13.7761 4 14 4.22386 14 4.5V8H15V4.5C15 3.67157 14.3284 3 13.5 3H1.5C0.671573 3 0 3.67157 0 4.5V10.5C0 11.3284 0.671573 12 1.5 12H6V11H1.5C1.22386 11 1 10.7761 1 10.5V4.5C1 4.22386 1.22386 4 1.5 4Z"
          fill={color}
        />
        <path d="M0.5 6.5H14.5" stroke={color} />
        <path d="M4.5 11.5V3.5" stroke={color} />
        <path d="M9.25 11.5H13.75" stroke={color} strokeLinecap="round" />
      </svg>
    );
  }
);

export const SheetDuplicateIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1.5 4H13.5C13.7761 4 14 4.22386 14 4.5V7H15V4.5C15 3.67157 14.3284 3 13.5 3H1.5C0.671573 3 0 3.67157 0 4.5V10.5C0 11.3284 0.671573 12 1.5 12H6V11H1.5C1.22386 11 1 10.7761 1 10.5V4.5C1 4.22386 1.22386 4 1.5 4Z"
          fill={color}
        />
        <path d="M0.5 6.5H14.5" stroke={color} />
        <path d="M4.5 11.5V3.5" stroke={color} />
        <path d="M9.25 11.5H13.75" stroke={color} strokeLinecap="round" />
        <path d="M11.5 13.75V9.25" stroke={color} strokeLinecap="round" />
      </svg>
    );
  }
);

export const SheetSwitchIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1.5 4H13.5C13.7761 4 14 4.22386 14 4.5V8H15V4.5C15 3.67157 14.3284 3 13.5 3H1.5C0.671573 3 0 3.67157 0 4.5V10.5C0 11.3284 0.671573 12 1.5 12H6V11H1.5C1.22386 11 1 10.7761 1 10.5V4.5C1 4.22386 1.22386 4 1.5 4Z"
          fill={color}
        />
        <path d="M0.5 6.5H14.5" stroke={color} />
        <path d="M4.5 11.5V3.5" stroke={color} />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.5 11.5C8.5 11.2239 8.72386 11 9 11L12.7929 11L11.6464 9.85355C11.4512 9.65829 11.4512 9.34171 11.6464 9.14645C11.8417 8.95118 12.1583 8.95118 12.3536 9.14645L14.3536 11.1464C14.4473 11.2402 14.5 11.3674 14.5 11.5C14.5 11.6326 14.4473 11.7598 14.3536 11.8536L12.3536 13.8536C12.1583 14.0488 11.8417 14.0488 11.6464 13.8536C11.4512 13.6583 11.4512 13.3417 11.6464 13.1464L12.7929 12L9 12C8.72386 12 8.5 11.7761 8.5 11.5Z"
          fill={color}
        />
      </svg>
    );
  }
);
