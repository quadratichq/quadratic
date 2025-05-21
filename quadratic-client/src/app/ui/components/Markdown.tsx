import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Markdown.scss';

interface Props {
  children: string;
}

export const Markdown = memo(({ children }: Props) => {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, children, ...props }) => (
            <a target="_blank" rel="noreferrer" {...props} className="test-link">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
