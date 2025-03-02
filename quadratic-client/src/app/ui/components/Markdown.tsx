import { cn } from '@/shared/shadcn/utils';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Markdown.scss';

interface Props {
  children: string;
  className?: string;
}

export const Markdown = memo(({ children, className }: Props) => {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} className={cn('markdown', className)} children={children} />;
});
