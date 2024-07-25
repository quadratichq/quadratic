import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  children: string;
}

export function Markdown({ children }: Props) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} children={children} />;
}
