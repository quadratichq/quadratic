import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { Favicon } from '@/shared/components/Favicon';
import { isContentGoogleSearchGroundingMetadata } from 'quadratic-shared/ai/helpers/message.helper';
import type { GoogleSearchContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useMemo } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';

const SourceSchema = z.object({
  title: z.string(),
  uri: z.string(),
});

const GoogleSearchMetaDataSchema = z.object({
  groundingChunks: z.array(
    z.object({
      web: SourceSchema,
    })
  ),
});

type Source = z.infer<typeof SourceSchema>;

export const GoogleSearchSources = memo(({ content }: { content: GoogleSearchContent }) => {
  const sources: Source[] = useMemo(
    () =>
      content.results
        .filter((result) => isContentGoogleSearchGroundingMetadata(result))
        .reduce<Source[]>((acc, result) => {
          try {
            const json = JSON.parse(result.text);
            const metaData = GoogleSearchMetaDataSchema.safeParse(json);
            if (!metaData.success) {
              return acc;
            }
            return [...acc, ...metaData.data.groundingChunks.map((chunk) => chunk.web)];
          } catch (error) {
            return acc;
          }
        }, []),
    [content]
  );

  return (
    <>
      <ToolCardQuery className="px-2" label="Searching the web." />

      <div className="flex flex-wrap gap-1 px-2">
        {sources.map((source, index) => (
          <Link
            key={`${index}-${source.title}`}
            className="flex w-fit cursor-pointer items-center rounded border border-border/50 px-1.5 py-1 text-xs text-muted-foreground hover:border-border hover:underline"
            to={source.uri}
            target="_blank"
          >
            <Favicon domain={source.title} size={12} alt={source.title} className="mr-1" />
            {source.title}
          </Link>
        ))}
      </div>
    </>
  );
});
