import {
  BorderBottomIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderAllIcon as BorderOuterIcon,
  BorderRightIcon,
  BorderStyleIcon,
  BorderTopIcon,
  CheckIcon,
  DotsHorizontalIcon,
  FontBoldIcon,
  FontItalicIcon,
  MagicWandIcon,
  MagnifyingGlassIcon,
  QuoteIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextIcon,
  TextNoneIcon,
} from '@radix-ui/react-icons';
import React from 'react';

export {
  BorderBottomIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderOuterIcon,
  BorderRightIcon,
  BorderStyleIcon,
  BorderTopIcon,
  CheckIcon,
  DotsHorizontalIcon,
  FontBoldIcon,
  FontItalicIcon,
  MagicWandIcon,
  MagnifyingGlassIcon,
  QuoteIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextIcon,
  TextNoneIcon,
};

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

export const BorderAllIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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

export const BorderColorIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M10.8534 1.14645C10.7597 1.05268 10.6325 1 10.4999 1C10.3673 1 10.2401 1.05268 10.1463 1.14645L3.71443 7.57836C3.62447 7.66832 3.5525 7.77461 3.50239 7.89155L2.04032 11.303C1.95978 11.491 2.00177 11.709 2.14634 11.8536C2.29091 11.9981 2.50893 12.0401 2.69685 11.9596L6.10835 10.4975C6.22528 10.4474 6.33158 10.3754 6.42153 10.2855L12.8534 3.85355C12.9472 3.75979 12.9999 3.63261 12.9999 3.5C12.9999 3.36739 12.9472 3.24021 12.8534 3.14645L10.8534 1.14645ZM3.78072 9.7807L4.42153 8.28547L10.4999 2.20711L11.7928 3.5L5.71443 9.57836L4.21919 10.2192L3.78072 9.7807Z"
          fill={color}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2.75134 13.5001C2.75134 13.0859 3.08713 12.7501 3.50134 12.7501H11.4987C11.9129 12.7501 12.2487 13.0859 12.2487 13.5001C12.2487 13.9143 11.9129 14.2501 11.4987 14.2501H3.50134C3.08713 14.2501 2.75134 13.9143 2.75134 13.5001Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const FileDeleteIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
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

export const CommandPaletteIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path d="M3 3.5L8 8L3 12.5" strokeWidth="1.1" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11.5H14" strokeWidth="1.1" stroke={color} strokeLinecap="round" />
      </svg>
    );
  }
);

export const DataIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M8.43844 12.7692C8.30831 12.7692 8.19965 12.724 8.11246 12.6336C8.02528 12.5432 7.98169 12.433 7.98169 12.3029C7.98169 12.1791 8.02528 12.0721 8.11246 11.9817C8.19965 11.8913 8.30831 11.8461 8.43844 11.8461H9.52689C9.94676 11.8461 10.3101 11.707 10.6168 11.4288C10.9235 11.1506 11.0769 10.8026 11.0769 10.3846V9.8538C11.0769 9.30572 11.2453 8.81966 11.5822 8.39563C11.919 7.97158 12.3545 7.69769 12.8884 7.57398V7.45955C12.3609 7.33775 11.9271 7.07108 11.587 6.65955C11.2469 6.24802 11.0769 5.76918 11.0769 5.22303V4.38458C11.0769 3.96663 10.9235 3.61856 10.6168 3.34036C10.3101 3.06216 9.94676 2.92306 9.52689 2.92306H8.43844C8.30831 2.92306 8.19965 2.87787 8.11246 2.78748C8.02528 2.6971 7.98169 2.58684 7.98169 2.45671C7.98169 2.33299 8.02528 2.22594 8.11246 2.13556C8.19965 2.04517 8.30831 1.99998 8.43844 1.99998H9.52689C10.207 1.99998 10.7892 2.23106 11.2735 2.69323C11.7578 3.15541 12 3.7192 12 4.38458V5.22303C12 5.64738 12.1565 6.00394 12.4697 6.29273C12.7828 6.58151 13.1612 6.7259 13.6048 6.7259C13.7176 6.7259 13.8117 6.76677 13.887 6.8485C13.9623 6.93023 14 7.0243 14 7.1307V7.90283C14 8.01564 13.9623 8.11132 13.887 8.18985C13.8117 8.26837 13.7176 8.30763 13.6048 8.30763C13.1612 8.30763 12.7828 8.45202 12.4697 8.7408C12.1565 9.02958 12 9.38616 12 9.81053V10.3846C12 11.05 11.7578 11.6138 11.2735 12.076C10.7892 12.5381 10.207 12.7692 9.52689 12.7692H8.43844Z"
          fill={color}
        />
        <path
          d="M4.47018 12.7692C3.79006 12.7692 3.20833 12.5381 2.725 12.0759C2.24167 11.6138 2 11.05 2 10.3846V9.81054C2 9.38618 1.84343 9.0296 1.53028 8.74082C1.21714 8.45204 0.841983 8.30764 0.4048 8.30764C0.291983 8.30764 0.196308 8.26839 0.117775 8.18987C0.0392585 8.11134 0 8.01566 0 7.90284V7.13072C0 7.02432 0.0392585 6.93025 0.117775 6.84852C0.196308 6.76679 0.291983 6.72592 0.4048 6.72592C0.841983 6.72592 1.21714 6.58153 1.53028 6.29274C1.84343 6.00396 2 5.6474 2 5.22305V4.3846C2 3.71922 2.24167 3.15543 2.725 2.69325C3.20833 2.23108 3.79006 2 4.47018 2H5.58078C5.71089 2 5.82114 2.04519 5.91153 2.13558C6.00193 2.22596 6.04713 2.33301 6.04713 2.45672C6.04713 2.58686 6.00193 2.69712 5.91153 2.7875C5.82114 2.87788 5.71089 2.92308 5.58078 2.92308H4.47018C4.05224 2.92308 3.68991 3.06217 3.38317 3.34037C3.07644 3.61857 2.92307 3.96665 2.92307 4.3846V5.22305C2.92307 5.7692 2.75304 6.24804 2.41298 6.65957C2.07291 7.0711 1.63909 7.33777 1.11153 7.45957V7.57399C1.64551 7.69771 2.08093 7.97159 2.41778 8.39564C2.75464 8.81968 2.92307 9.30574 2.92307 9.85382V10.3846C2.92307 10.8025 3.07644 11.1506 3.38317 11.4288C3.68991 11.707 4.05224 11.8461 4.47018 11.8461H5.58078C5.71089 11.8461 5.82114 11.8913 5.91153 11.9817C6.00193 12.0721 6.04713 12.1791 6.04713 12.3028C6.04713 12.433 6.00193 12.5432 5.91153 12.6336C5.82114 12.724 5.71089 12.7692 5.58078 12.7692H4.47018Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const TextFormatIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1.94993 2.95005L1.94993 4.50001C1.94993 4.74854 1.74845 4.95001 1.49993 4.95001C1.2514 4.95001 1.04993 4.74854 1.04993 4.50001V2.50007C1.04993 2.45249 1.05731 2.40665 1.07099 2.3636C1.12878 2.18178 1.29897 2.05005 1.49993 2.05005H9.49993C9.65526 2.05005 9.79221 2.12875 9.87308 2.24845C9.9216 2.32027 9.94993 2.40685 9.94993 2.50005L9.94994 2.50007V4.50001C9.94994 4.74854 9.74847 4.95001 9.49994 4.95001C9.25141 4.95001 9.04994 4.74854 9.04994 4.50001V2.95005H6.04993V12.0501H7.25428C7.50281 12.0501 7.70428 12.2515 7.70428 12.5001C7.70428 12.7486 7.50281 12.9501 7.25428 12.9501H3.75428C3.50575 12.9501 3.30428 12.7486 3.30428 12.5001C3.30428 12.2515 3.50575 12.0501 3.75428 12.0501H4.94993V2.95005H1.94993Z"
          fill={color}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.38706 10.0803C8.49764 8.7374 9.36862 7.49543 11 6C12.75 7.60417 13.625 8.91667 13.625 10.375C13.625 11.8247 12.4497 13 11 13C9.55025 13 8.375 11.8247 8.375 10.375C8.375 10.3178 8.37635 10.2608 8.37904 10.204C8.37636 10.1572 8.375 10.11 8.375 10.0625C8.37901 10.0685 8.38303 10.0745 8.38706 10.0803ZM12.5163 9.63396C11.8707 9.47907 11.1834 9.797 10.536 10.0964C10.1284 10.285 9.73659 10.4662 9.38115 10.5173C9.37708 10.4704 9.375 10.423 9.375 10.375C9.375 9.51151 9.80453 8.6132 11 7.3892C11.8602 8.26997 12.3239 8.98209 12.5163 9.63396Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const CellFormatIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7 5H1L1 10H7V11H1C0.447715 11 0 10.5523 0 10V5C0 4.44772 0.447715 4 1 4H14C14.5523 4 15 4.44772 15 5H14H7ZM12 6C10.3686 7.49543 9.49764 8.7374 9.38706 10.0803L9.375 10.0625C9.375 10.11 9.37636 10.1572 9.37904 10.204C9.37635 10.2608 9.375 10.3178 9.375 10.375C9.375 11.8247 10.5503 13 12 13C13.4497 13 14.625 11.8247 14.625 10.375C14.625 8.91667 13.75 7.60417 12 6ZM11.536 10.0964C12.1834 9.797 12.8707 9.47907 13.5163 9.63396C13.3239 8.98209 12.8602 8.26997 12 7.3892C10.8045 8.6132 10.375 9.51151 10.375 10.375C10.375 10.423 10.3771 10.4704 10.3811 10.5173C10.7366 10.4662 11.1284 10.285 11.536 10.0964Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const TextColorIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7.84088 3.07664C7.76832 2.88034 7.58118 2.75 7.3719 2.75C7.16261 2.75 6.97547 2.88034 6.90291 3.07664L3.82754 11.3962C3.73179 11.6552 3.86415 11.9428 4.12316 12.0386C4.38217 12.1343 4.66976 12.002 4.76551 11.7429L5.77352 9.01603H8.97027L9.97828 11.7429C10.074 12.002 10.3616 12.1343 10.6206 12.0386C10.8796 11.9428 11.012 11.6552 10.9163 11.3962L7.84088 3.07664ZM8.65606 8.16603L7.3719 4.69207L6.08773 8.16603H8.65606Z"
          fill={color}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2.75134 13.5001C2.75134 13.0859 3.08713 12.7501 3.50134 12.7501H11.4987C11.9129 12.7501 12.2487 13.0859 12.2487 13.5001C12.2487 13.9143 11.9129 14.2501 11.4987 14.2501H3.50134C3.08713 14.2501 2.75134 13.9143 2.75134 13.5001Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const PaintBucketIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2.75134 13.5001C2.75134 13.0859 3.08713 12.7501 3.50134 12.7501H11.4987C11.9129 12.7501 12.2487 13.0859 12.2487 13.5001C12.2487 13.9143 11.9129 14.2501 11.4987 14.2501H3.50134C3.08713 14.2501 2.75134 13.9143 2.75134 13.5001Z"
          fill={color}
        />
        <path
          d="M4.38006 0.559519L4.89698 0L11.6089 6.59824C11.8696 6.86063 12 7.17016 12 7.52685C12 7.88354 11.8696 8.19045 11.6089 8.44756L8.41922 11.6246C8.16704 11.8733 7.86143 11.9984 7.5024 12C7.14336 12.0016 6.83882 11.8764 6.58878 11.6246L3.39911 8.44756C3.13304 8.19045 3 7.88354 3 7.52685C3 7.17016 3.13304 6.86063 3.39911 6.59824L6.97024 3.11379L4.38006 0.559519ZM7.52644 3.63934L3.88236 7.20124C3.82894 7.25393 3.79635 7.30925 3.7846 7.36721C3.77284 7.42517 3.76269 7.48576 3.75413 7.54898H11.2435C11.2435 7.48576 11.2341 7.42517 11.2154 7.36721C11.1967 7.30925 11.1633 7.25393 11.1152 7.20124L7.52644 3.63934Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const DecimalIncreaseIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M9.03516 4.59439V7.99226C9.03516 8.22562 9.22434 8.4148 9.4577 8.4148C9.69107 8.4148 9.88025 8.22562 9.88025 7.99226V4.59439C9.88025 4.11862 10.0388 3.71423 10.3559 3.3812C10.673 3.04815 11.0593 2.88163 11.5149 2.88163C11.9704 2.88163 12.3576 3.04815 12.6765 3.3812C12.9954 3.71423 13.1549 4.11862 13.1549 4.59439V6.99226C13.1549 7.22562 13.344 7.4148 13.5774 7.4148C13.8108 7.4148 14 7.22562 14 6.99226V4.59439C14 3.87784 13.7574 3.26631 13.2724 2.75978C12.7874 2.25326 12.2022 2 11.5168 2C10.8314 2 10.2464 2.25326 9.76192 2.75978C9.27741 3.26631 9.03516 3.87784 9.03516 4.59439Z"
          fill={color}
        />
        <path
          d="M0.739442 11C0.331059 11 0 10.6689 0 10.2606V10.1966C0 9.78819 0.331059 9.45713 0.739442 9.45713V9.45713C1.14782 9.45713 1.47888 9.78819 1.47888 10.1966V10.2606C1.47888 10.6689 1.14782 11 0.739442 11V11ZM5.29387 11C4.60677 11 4.02216 10.7476 3.54007 10.2429C3.05795 9.73817 2.8169 9.1288 2.8169 8.4148V4.59439C2.8169 3.87784 3.05915 3.26631 3.54366 2.75978C4.02815 2.25326 4.6131 2 5.2985 2C5.98389 2 6.5691 2.25326 7.05413 2.75978C7.53917 3.26631 7.7817 3.87784 7.7817 4.59439V8.4148C7.7817 9.1288 7.53884 9.73817 7.05313 10.2429C6.5674 10.7476 5.98098 11 5.29387 11ZM5.29577 10.1184C5.74961 10.1184 6.13654 9.95275 6.45657 9.6215C6.77659 9.29024 6.93661 8.88801 6.93661 8.4148V4.59439C6.93661 4.11862 6.77717 3.71423 6.45828 3.3812C6.13939 3.04815 5.75216 2.88163 5.2966 2.88163C4.84105 2.88163 4.45473 3.04815 4.13763 3.3812C3.82053 3.71423 3.66199 4.11862 3.66199 4.59439V8.4148C3.66199 8.88801 3.82082 9.29024 4.1385 9.6215C4.45619 9.95275 4.84195 10.1184 5.29577 10.1184Z"
          fill={color}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.50005 11.05C8.25152 11.05 8.05005 11.2515 8.05005 11.5C8.05005 11.7485 8.25152 11.95 8.50005 11.95L13.4137 11.95L12.1819 13.1818C12.0061 13.3575 12.0061 13.6425 12.1819 13.8182C12.3576 13.9939 12.6425 13.9939 12.8182 13.8182L14.8182 11.8182C14.994 11.6425 14.994 11.3575 14.8182 11.1818L12.8182 9.18181C12.6425 9.00608 12.3576 9.00608 12.1819 9.18181C12.0061 9.35755 12.0061 9.64247 12.1819 9.81821L13.4137 11.05L8.50005 11.05Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const DecimalDecreaseIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M0.739442 11C0.331059 11 0 10.6689 0 10.2606V10.1966C0 9.78819 0.331059 9.45713 0.739442 9.45713V9.45713C1.14782 9.45713 1.47888 9.78819 1.47888 10.1966V10.2606C1.47888 10.6689 1.14782 11 0.739442 11V11ZM5.29387 11C4.60677 11 4.02216 10.7476 3.54007 10.2429C3.05795 9.73817 2.8169 9.1288 2.8169 8.4148V4.59439C2.8169 3.87784 3.05915 3.26631 3.54366 2.75978C4.02815 2.25326 4.6131 2 5.2985 2C5.98389 2 6.5691 2.25326 7.05413 2.75978C7.53917 3.26631 7.7817 3.87784 7.7817 4.59439V8.4148C7.7817 9.1288 7.53884 9.73817 7.05313 10.2429C6.5674 10.7476 5.98098 11 5.29387 11ZM5.29577 10.1184C5.74961 10.1184 6.13654 9.95275 6.45657 9.6215C6.77659 9.29024 6.93661 8.88801 6.93661 8.4148V4.59439C6.93661 4.11862 6.77717 3.71423 6.45828 3.3812C6.13939 3.04815 5.75216 2.88163 5.2966 2.88163C4.84105 2.88163 4.45473 3.04815 4.13763 3.3812C3.82053 3.71423 3.66199 4.11862 3.66199 4.59439V8.4148C3.66199 8.88801 3.82082 9.29024 4.1385 9.6215C4.45619 9.95275 4.84195 10.1184 5.29577 10.1184Z"
          fill={color}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M14.5001 11.95C14.7486 11.95 14.9501 11.7485 14.9501 11.5C14.9501 11.2515 14.7486 11.05 14.5001 11.05L9.58647 11.05L10.8183 9.81819C10.994 9.64245 10.994 9.35753 10.8183 9.18179C10.6425 9.00605 10.3576 9.00605 10.1819 9.18179L8.18187 11.1818C8.00614 11.3575 8.00614 11.6424 8.18187 11.8182L10.1819 13.8182C10.3576 13.9939 10.6425 13.9939 10.8183 13.8182C10.994 13.6425 10.994 13.3575 10.8183 13.1818L9.58647 11.95L14.5001 11.95Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const DollarIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M7 2.5V0H8V2.5H7ZM9.70319 4.6C9.64653 4.125 9.41677 3.75625 9.0139 3.49375C8.61102 3.23125 8.11687 3.1 7.53144 3.1C7.10339 3.1 6.72884 3.16875 6.4078 3.30625C6.08991 3.44375 5.84126 3.63281 5.66186 3.87344C5.4856 4.11406 5.39747 4.3875 5.39747 4.69375C5.39747 4.95 5.45885 5.17031 5.5816 5.35469C5.70749 5.53594 5.86801 5.6875 6.06316 5.80937C6.2583 5.92812 6.46288 6.02656 6.67691 6.10469C6.89094 6.17969 7.08765 6.24063 7.26706 6.2875L8.24906 6.55C8.50086 6.61563 8.78098 6.70625 9.08943 6.82188C9.40103 6.9375 9.69847 7.09531 9.98174 7.29531C10.2682 7.49219 10.5042 7.74531 10.6899 8.05469C10.8756 8.36406 11 8.74375 11 9.19375C11 9.7125 10.8316 10.1813 10.5577 10.6C10.287 11.0188 9.89046 11.3828 9.36798 11.6297C8.84865 11.8766 8.21759 12 7.47479 12C6.78235 12 6.18276 11.8891 5.67602 11.6672C5.17243 11.4453 4.77585 11.1047 4.48628 10.7078C4.19986 10.3109 4.03777 9.775 4 9.25H5.20862C5.2401 9.6125 5.36285 9.9875 5.57687 10.225C5.79405 10.4594 6.06788 10.6344 6.39836 10.75C6.73199 10.8625 7.0908 10.9187 7.47479 10.9187C7.92173 10.9187 8.32303 10.8469 8.67869 10.7031C9.03435 10.5563 9.31605 10.3531 9.52378 10.0938C9.73152 9.83125 9.86692 9.525 9.86692 9.175C9.86692 8.85625 9.74568 8.59688 9.56627 8.39688C9.38687 8.19688 9.15081 8.03437 8.8581 7.90937C8.56538 7.78437 8.24906 7.675 7.90914 7.58125L6.7194 7.24375C5.96401 7.02813 5.366 6.72031 4.92535 6.32031C4.48471 5.92031 4.26439 5.39688 4.26439 4.75C4.26439 4.2125 4.41074 3.74375 4.70346 3.34375C4.99932 2.94063 5.3959 2.62813 5.89319 2.40625C6.39364 2.18125 6.95231 2.06875 7.56921 2.06875C8.19241 2.06875 8.74636 2.17969 9.23107 2.40156C9.71578 2.62031 10.0998 2.92031 10.383 3.30156C10.6695 3.68281 10.8205 4.11562 10.8363 4.6H9.70319Z"
          fill={color}
        />
        <path d="M7 14V11.5H8V14H7Z" fill={color} />
      </svg>
    );
  }
);

export const PercentIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M8.61674 10.846V10.2814C8.61674 9.891 8.70118 9.53375 8.87004 9.2096C9.04259 8.88197 9.29222 8.62056 9.61894 8.42538C9.94934 8.22671 10.3495 8.12738 10.8194 8.12738C11.2966 8.12738 11.6968 8.22671 12.0198 8.42538C12.3429 8.62056 12.587 8.88197 12.7522 9.2096C12.9174 9.53375 13 9.891 13 10.2814V10.846C13 11.2364 12.9156 11.5954 12.7467 11.923C12.5815 12.2471 12.3355 12.5086 12.0088 12.7072C11.6858 12.9024 11.2893 13 10.8194 13C10.3421 13 9.94016 12.9024 9.61344 12.7072C9.28671 12.5086 9.03891 12.2471 8.87004 11.923C8.70118 11.5954 8.61674 11.2364 8.61674 10.846ZM9.74009 10.2814V10.846C9.74009 11.1702 9.82085 11.4612 9.98238 11.7191C10.1439 11.9735 10.4229 12.1008 10.8194 12.1008C11.2048 12.1008 11.4765 11.9735 11.6344 11.7191C11.7959 11.4612 11.8767 11.1702 11.8767 10.846V10.2814C11.8767 9.95722 11.7996 9.66794 11.6454 9.4135C11.4912 9.15558 11.2159 9.02662 10.8194 9.02662C10.4339 9.02662 10.1568 9.15558 9.98789 9.4135C9.82269 9.66794 9.74009 9.95722 9.74009 10.2814ZM2 4.71863V4.15399C2 3.76363 2.08443 3.40637 2.2533 3.08222C2.42584 2.75459 2.67548 2.49319 3.0022 2.298C3.3326 2.09933 3.73275 2 4.20264 2C4.67988 2 5.08003 2.09933 5.40308 2.298C5.72614 2.49319 5.97026 2.75459 6.13546 3.08222C6.30066 3.40637 6.38326 3.76363 6.38326 4.15399V4.71863C6.38326 5.109 6.29883 5.468 6.12996 5.79563C5.96476 6.11977 5.7188 6.38118 5.39207 6.57985C5.06902 6.77503 4.67254 6.87262 4.20264 6.87262C3.7254 6.87262 3.32342 6.77503 2.9967 6.57985C2.66997 6.38118 2.42217 6.11977 2.2533 5.79563C2.08443 5.468 2 5.109 2 4.71863ZM3.12335 4.15399V4.71863C3.12335 5.04278 3.20411 5.33381 3.36564 5.59173C3.52717 5.84617 3.80617 5.97338 4.20264 5.97338C4.58811 5.97338 4.85977 5.84617 5.01762 5.59173C5.17915 5.33381 5.25991 5.04278 5.25991 4.71863V4.15399C5.25991 3.82985 5.18282 3.54056 5.02863 3.28612C4.87445 3.0282 4.59912 2.89924 4.20264 2.89924C3.81718 2.89924 3.54001 3.0282 3.37115 3.28612C3.20595 3.54056 3.12335 3.82985 3.12335 4.15399ZM3 13L10.8889 2H12L4.11111 13H3Z"
          fill={color}
        />
      </svg>
    );
  }
);

export const FunctionIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path d="M3 13V11.9769L8.5 7.5L3 3V2H12V3H4.5L10 7.5L4.5 12H12V13H3Z" fill={color} />
      </svg>
    );
  }
);

export const NumberFormatIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M1.46925 5.83845H0.42405C0.300116 5.83845 0.198458 5.79885 0.119075 5.71965C0.0396917 5.64043 0 5.53899 0 5.41533C0 5.29806 0.0396917 5.19952 0.119075 5.1197C0.198458 5.0399 0.300116 5 0.42405 5H1.89327C2.01079 5 2.10924 5.03969 2.18862 5.11908C2.26801 5.19844 2.3077 5.29689 2.3077 5.41443V9.86828C2.3077 9.99221 2.26809 10.0939 2.18888 10.1732C2.10968 10.2526 2.01144 10.2923 1.89417 10.2923C1.77049 10.2923 1.66875 10.2526 1.58895 10.1732C1.50915 10.0939 1.46925 9.99221 1.46925 9.86828V5.83845ZM4.86925 9.86828V7.9846C4.86925 7.77692 4.9404 7.60192 5.0827 7.4596C5.22502 7.3173 5.40002 7.24615 5.6077 7.24615H7.9077V5.83845H5.29328C5.16934 5.83845 5.06768 5.79885 4.9883 5.71965C4.90893 5.64043 4.86925 5.53899 4.86925 5.41533C4.86925 5.29806 4.90893 5.19952 4.9883 5.1197C5.06768 5.0399 5.16934 5 5.29328 5H8.0077C8.2154 5 8.3904 5.07115 8.5327 5.21345C8.67502 5.35577 8.74617 5.53077 8.74617 5.73845V7.3077C8.74617 7.51538 8.67502 7.69038 8.5327 7.8327C8.3904 7.975 8.2154 8.04615 8.0077 8.04615H5.7077V9.45385H8.33175C8.44927 9.45385 8.54772 9.49345 8.6271 9.57265C8.70648 9.65187 8.74617 9.75011 8.74617 9.86738C8.74617 9.99104 8.70648 10.0928 8.6271 10.1726C8.54772 10.2524 8.44927 10.2923 8.33175 10.2923H5.29328C5.16934 10.2923 5.06768 10.2526 4.9883 10.1732C4.90893 10.0939 4.86925 9.99221 4.86925 9.86828ZM13.9616 10.2923H11.2471C11.1232 10.2923 11.0215 10.2527 10.9422 10.1735C10.8628 10.0943 10.8231 9.99283 10.8231 9.86915C10.8231 9.7519 10.8628 9.65337 10.9422 9.57355C11.0215 9.49375 11.1232 9.45385 11.2471 9.45385H13.8616V8.04615H12.2231C12.1186 8.04615 12.0258 8.00561 11.9447 7.92453C11.8636 7.84343 11.8231 7.75063 11.8231 7.64615C11.8231 7.54167 11.8636 7.44888 11.9447 7.36778C12.0258 7.28669 12.1186 7.24615 12.2231 7.24615H13.8616V5.83845H11.2471C11.1232 5.83845 11.0215 5.79885 10.9422 5.71965C10.8628 5.64043 10.8231 5.53899 10.8231 5.41533C10.8231 5.29806 10.8628 5.19952 10.9422 5.1197C11.0215 5.0399 11.1232 5 11.2471 5H13.9616C14.1693 5 14.3443 5.07115 14.4866 5.21345C14.6289 5.35577 14.7 5.53077 14.7 5.73845V9.55385C14.7 9.76153 14.6289 9.93653 14.4866 10.0789C14.3443 10.2212 14.1693 10.2923 13.9616 10.2923Z"
          fill={color}
        />
      </svg>
    );
  }
);
