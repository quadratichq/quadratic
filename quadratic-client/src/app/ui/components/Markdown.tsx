import { Textarea } from '@/shared/shadcn/ui/textarea';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Markdown.scss';

interface MarkdownProps {
  text: string;
  onChange?: (text: string) => void;
}
export const Markdown = memo(({ text, onChange }: MarkdownProps) => {
  if (!!onChange) {
    return (
      <Textarea
        autoComplete="off"
        value={text}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.value);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        autoHeight={true}
        className="overflow-hidden p-0"
      />
    );
  }

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, children, ...props }) => (
            <a target="_blank" rel="noreferrer" {...props} className="underline hover:text-primary">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
