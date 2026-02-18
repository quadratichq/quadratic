import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useEffect, useState } from 'react';

export function FileContentsSettings() {
  const [jsonContent, setJsonContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJson = async () => {
      try {
        const json = await quadraticCore.exportJson();
        setJsonContent(JSON.stringify(JSON.parse(json), null, 2));
      } catch (e) {
        setJsonContent(`Error: ${e}`);
      }
      setIsLoading(false);
    };
    fetchJson();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2">
        <h3 className="text-sm font-normal text-muted-foreground">
          Current file contents as JSON for debugging purposes
        </h3>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <textarea
          readOnly
          value={jsonContent}
          className="min-h-0 flex-1 rounded border bg-muted p-2 font-mono text-xs"
        />
      )}
    </div>
  );
}
