export const QuadraticLogo = ({ singleColor }: { singleColor?: boolean }) => (
  <svg width="13" height="20" viewBox="0 0 13 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0H6V6H0V0Z" fill={singleColor ? 'currentColor' : '#CB8999'} />
    <path d="M6 7H0V13H6V7Z" fill={singleColor ? 'currentColor' : '#5D576B'} />
    <path d="M13 0H7V6H13V0Z" fill={singleColor ? 'currentColor' : '#8ECB89'} />
    <path d="M13 14H7V20H13V14Z" fill={singleColor ? 'currentColor' : '#FFC800'} />
    <path d="M13 7H7V13H13V7Z" fill={singleColor ? 'currentColor' : '#6CD4FF'} />
  </svg>
);

export const QuadraticLogo7px = () => (
  <svg width="15" height="23" viewBox="0 0 15 23" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0H7V7H0V0Z" fill="#CB8999" />
    <path d="M7 8H0V15H7V8Z" fill="#5D576B" />
    <path d="M15 0H8V7H15V0Z" fill="#8ECB89" />
    <path d="M15 16H8V23H15V16Z" fill="#FFC800" />
    <path d="M15 8H8V15H15V8Z" fill="#6CD4FF" />
  </svg>
);
