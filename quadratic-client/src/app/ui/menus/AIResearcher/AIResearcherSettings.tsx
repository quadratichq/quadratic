import { exaSettingsAtom } from '@/app/atoms/exaSettingsAtom';
import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { Input } from '@/shared/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import type { ExaSearchRequestBody } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilState } from 'recoil';

export const AIResearcherSettings = () => {
  const [exaSettings, setExaSettings] = useRecoilState(exaSettingsAtom);
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-2">
      <span className="font-bold">Exa Settings (for testing):</span>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="useAutoprompt"
          checked={exaSettings.useAutoprompt}
          onCheckedChange={(checked) => setExaSettings({ ...exaSettings, useAutoprompt: !!checked })}
        />
        <label htmlFor="useAutoprompt" className="cursor-pointer text-sm font-medium">
          Use Autoprompt
        </label>
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="type" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          Query type
        </label>

        <Select
          value={exaSettings.type}
          name="type"
          onValueChange={(value: ExaSearchRequestBody['type']) => setExaSettings({ ...exaSettings, type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['auto', 'neural', 'keyword'].map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="numResults" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          Number of results
        </label>

        <Input
          type="number"
          name="numResults"
          min={1}
          max={25}
          value={exaSettings.numResults ?? ''}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value)) {
              setExaSettings({ ...exaSettings, numResults: Math.min(Math.max(value, 1), 25) });
            } else {
              setExaSettings({ ...exaSettings, numResults: undefined });
            }
          }}
        />
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="livecrawl" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          Livecrawl
        </label>

        <Select
          value={exaSettings.livecrawl}
          name="livecrawl"
          onValueChange={(value: ExaSearchRequestBody['livecrawl']) =>
            setExaSettings({ ...exaSettings, livecrawl: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['never', 'fallback', 'always'].map((livecrawl, i) => (
              <SelectItem key={livecrawl} value={livecrawl}>
                {livecrawl}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={`flex items-center space-x-2`}>
        <Checkbox
          id="text"
          checked={exaSettings.text}
          onCheckedChange={(checked) => setExaSettings({ ...exaSettings, text: !!checked })}
        />
        <label htmlFor="text" className="cursor-pointer text-sm font-medium">
          Include text in results
        </label>
      </div>

      <div className={`flex items-center space-x-2`}>
        <Checkbox
          id="highlights"
          checked={exaSettings.highlights}
          onCheckedChange={(checked) => setExaSettings({ ...exaSettings, highlights: !!checked })}
        />
        <label htmlFor="highlights" className="cursor-pointer text-sm font-medium">
          Include highlights in results
        </label>
      </div>

      <div className={`flex items-center space-x-2`}>
        <Checkbox
          id="summary"
          checked={exaSettings.summary}
          onCheckedChange={(checked) => setExaSettings({ ...exaSettings, summary: !!checked })}
        />
        <label htmlFor="summary" className="cursor-pointer text-sm font-medium">
          Include summary in results
        </label>
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="categories" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          Categories
        </label>

        <Select
          value={exaSettings.categories ?? 'any'}
          name="categories"
          onValueChange={(value: string) =>
            setExaSettings({
              ...exaSettings,
              categories: value === 'any' ? undefined : (value as ExaSearchRequestBody['categories']),
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              'any',
              'company',
              'research paper',
              'news',
              'github',
              'tweet',
              'movie',
              'song',
              'personal site',
              'pdf',
            ].map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="includeText" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          Include Text
        </label>

        <Input
          type="text"
          name="includeText"
          value={exaSettings.includeText.join(',')}
          onChange={(e) => {
            const value = e.target.value;
            const textArray = value.split(',');
            setExaSettings({ ...exaSettings, includeText: textArray });
          }}
        />
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="excludeText" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          Exclude Text
        </label>

        <Input
          type="text"
          name="excludeText"
          value={exaSettings.excludeText.join(',')}
          onChange={(e) => {
            const value = e.target.value;
            const textArray = value.split(',');
            setExaSettings({ ...exaSettings, excludeText: textArray });
          }}
        />
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="includeDomains" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          Include Domains
        </label>

        <Input
          type="text"
          name="includeDomains"
          value={exaSettings.includeDomains.join(',')}
          onChange={(e) => {
            const value = e.target.value;
            const textArray = value.split(',');
            setExaSettings({ ...exaSettings, includeDomains: textArray });
          }}
        />
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="excludeDomains" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          Exclude Domains
        </label>

        <Input
          type="text"
          name="excludeDomains"
          value={exaSettings.excludeDomains.join(',')}
          onChange={(e) => {
            const value = e.target.value;
            const textArray = value.split(',');
            setExaSettings({ ...exaSettings, excludeDomains: textArray });
          }}
        />
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="startPublishedDate" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          Start Published Date
        </label>

        <Input
          type="datetime-local"
          name="startPublishedDate"
          value={exaSettings.startPublishedDate}
          onChange={(e) => {
            const value = e.target.value;
            setExaSettings({ ...exaSettings, startPublishedDate: value });
          }}
        />
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="endPublishedDate" className="cursor-pointer whitespace-nowrap text-sm font-medium">
          End Published Date
        </label>

        <Input
          type="datetime-local"
          name="endPublishedDate"
          value={exaSettings.endPublishedDate}
          onChange={(e) => {
            const value = e.target.value;
            setExaSettings({ ...exaSettings, endPublishedDate: value });
          }}
        />
      </div>
    </div>
  );
};
