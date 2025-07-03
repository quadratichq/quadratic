import { memo } from 'react';

interface IframeIndexeddbProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}
export const IframeIndexeddb = memo(({ iframeRef }: IframeIndexeddbProps) => {
  return (
    <iframe
      ref={iframeRef}
      src={`/iframe-indexeddb`}
      title="Iframe for indexeddb"
      className="hidden"
      sandbox="allow-scripts allow-same-origin"
    />
  );
});
