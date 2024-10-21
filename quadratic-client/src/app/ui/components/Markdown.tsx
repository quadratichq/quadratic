import { cn } from '@/shared/shadcn/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Markdown.scss';

interface Props {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: Props) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} className={cn('markdown', className)} children={children} />;
}
