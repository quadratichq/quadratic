import { PROMPTLAYER_API_KEY, PROMPTLAYER_WORKSPACE_ID } from '../../env-vars';

// Cache object to store documentation with timestamps
interface CachedDoc {
  content: string;
  timestamp: number;
}

const docsCache = new Map<string, CachedDoc>();
const CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

// Get documentation with caching and PromptLayer integration
export async function getDocs(type: string, fallback: string, version: number = 1): Promise<string> {
  const cached = docsCache.get(type);
  const now = Date.now();

  // If cache is valid, return immediately
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }

  try {
    const url = `https://api.promptlayer.com/prompt-templates/${type}`;
    const requestBody = {
      version,
      workspace_id: PROMPTLAYER_WORKSPACE_ID,
      input_variables: {},
      metadata_filters: {},
    };

    // Attempt to fetch from PromptLayer
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': PROMPTLAYER_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from PromptLayer: ${response.status} ${response.statusText}`);
    }

    const template = JSON.parse(await response.text());

    if (!template || !template.prompt_template) {
      throw new Error(`No template found for type: ${type}`);
    }

    const content = template.prompt_template;

    // Cache the fetched content
    docsCache.set(type, {
      content,
      timestamp: now,
    });
    return content;
  } catch (error) {
    // Cache and return fallback content
    docsCache.set(type, {
      content: fallback,
      timestamp: now,
    });
    return fallback;
  }
}
