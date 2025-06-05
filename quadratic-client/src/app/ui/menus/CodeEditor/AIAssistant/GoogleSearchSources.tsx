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
    <div className="flex flex-col gap-2 px-2">
      <div className="text-sm font-medium">Sources</div>

      <div className="flex flex-wrap gap-2">
        {sources.map((source, index) => (
          <Link
            key={`${index}-${source.title}`}
            className="flex h-8 w-fit cursor-pointer items-center rounded-md bg-accent p-2 text-sm hover:bg-accent/80"
            to={source.uri}
            target="_blank"
          >
            <Favicon domain={source.title} size={12} alt={source.title} className="mr-2 h-4 w-4" />
            {source.title}
          </Link>
        ))}
      </div>
    </div>
  );
});
