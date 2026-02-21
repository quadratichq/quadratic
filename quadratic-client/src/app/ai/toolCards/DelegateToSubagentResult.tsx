import { Markdown } from '@/app/ui/components/Markdown';
import { isContentText } from 'quadratic-shared/ai/helpers/message.helper';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo } from 'react';

type DelegateToSubagentResultProps = {
  content: ToolResultContent;
  className?: string;
};

function getSummaryText(content: ToolResultContent): string {
  return content
    .filter(isContentText)
    .map((c) => c.text)
    .join('\n');
}

export const DelegateToSubagentResult = memo(({ content, className }: DelegateToSubagentResultProps) => {
  const summaryText = getSummaryText(content);
  return (
    <div className={className} data-testid="delegate-to-subagent-result">
      <div className="my-1 rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
        <div className="font-semibold text-foreground">Summary (returned to main agent):</div>
        {summaryText ? (
          <div className="mt-0.5">
            <Markdown text={summaryText} />
          </div>
        ) : (
          <div className="mt-0.5 opacity-60">(no summary)</div>
        )}
      </div>
    </div>
  );
});
