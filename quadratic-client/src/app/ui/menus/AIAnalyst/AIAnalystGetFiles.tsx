import { memo, useEffect, useMemo, useRef } from 'react';

const IFRAME_ORIGIN =
  'https://quadratic-website-git-ayush-iframfiletransfer.vercel.quadratic-preview.com/IframeIndexedDb';

// const IFRAME_ORIGIN = 'http://localhost:8080/IframeIndexedDb';

export const AIAnalystGetFiles = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const chatId = useMemo(() => {
    return '4c30068b-ec53-4b15-b6eb-b2c841cbd015';
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) return;

      console.log('event', event.data);

      if (event.data.type !== 'get-chat-files-response') {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'get-chat-files',
            chatId,
          },
          IFRAME_ORIGIN
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [chatId]);

  useEffect(() => {
    iframeRef.current = document.createElement('iframe');
    iframeRef.current.src = IFRAME_ORIGIN;
    iframeRef.current.style.display = 'none';
    iframeRef.current.setAttribute(
      'sandbox',
      'allow-same-origin allow-scripts allow-storage-access-by-user-activation'
    );

    iframeRef.current.onload = () => {
      console.log('Iframe loaded');
    };

    iframeRef.current.onerror = (error) => {
      console.error('Iframe failed to load:', error);
    };

    document.body.appendChild(iframeRef.current);
    console.log('iframe', iframeRef.current);
  }, []);

  return null;
});
