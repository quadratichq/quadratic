import { Favicon } from '@/shared/components/Favicon';
import { isContentGoogleSearchGroundingMetadata } from 'quadratic-shared/ai/helpers/message.helper';
import type { GoogleSearchContent, WebSearchResult } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useMemo } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';

interface Source {
  title: string;
  url: string;
}

// Legacy Google Search grounding metadata schema for backwards compatibility
const GoogleSearchMetaDataSchema = z.object({
  groundingChunks: z.array(
    z.object({
      web: z.object({
        title: z.string(),
        uri: z.string(),
      }),
    })
  ),
});

// Type guard for new WebSearchResult format
const isWebSearchResult = (result: unknown): result is WebSearchResult => {
  return (
    typeof result === 'object' &&
    result !== null &&
    'url' in result &&
    'title' in result &&
    typeof (result as WebSearchResult).url === 'string'
  );
};

export const WebSearchSources = memo(({ content }: { content: GoogleSearchContent }) => {
  const sources: Source[] = useMemo(() => {
    // Handle new web_search format
    if (content.source === 'web_search') {
      return content.results.map((result: WebSearchResult) => ({
        title: result.title,
        url: result.url,
      }));
    }

    // Handle legacy google_search format (backwards compatibility)
    return content.results
      .filter((result) => !isWebSearchResult(result) && isContentGoogleSearchGroundingMetadata(result))
      .reduce<Source[]>((acc, result) => {
        try {
          if (!('text' in result)) return acc;
          const json = JSON.parse(result.text);
          const metaData = GoogleSearchMetaDataSchema.safeParse(json);
          if (!metaData.success) {
            return acc;
          }
          return [
            ...acc,
            ...metaData.data.groundingChunks.map((chunk) => ({
              title: chunk.web.title,
              url: chunk.web.uri,
            })),
          ];
        } catch (error) {
          return acc;
        }
      }, []);
  }, [content]);

  return (
    <div className="flex flex-wrap gap-1 px-2">
      {sources.map((source, index) => (
        <Link
          key={`${index}-${source.title}`}
          className="flex w-fit cursor-pointer items-center rounded border border-border/50 px-1.5 py-1 text-xs text-muted-foreground hover:border-border hover:underline"
          to={source.url}
          target="_blank"
        >
          <Favicon domain={source.url} size={12} alt={source.title} className="mr-1" />
          {source.title}
        </Link>
      ))}
    </div>
  );
});

// Legacy alias for backwards compatibility
export const GoogleSearchSources = WebSearchSources;
