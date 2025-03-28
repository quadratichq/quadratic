import { getVertexAIForTask } from '../helpers/vertex.helper';

// Cache object to store documentation with timestamps
interface CachedDoc {
  content: string;
  timestamp: number;
}

const docsCache = new Map<string, CachedDoc>();
const CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
// Get documentation with caching and Vertex AI integration
export async function getDocs(type: string, fallback: string): Promise<string> {
  const cached = docsCache.get(type);

  // If cache is valid, return immediately
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }

  try {
    // Attempt to fetch from Vertex AI
    const vertexAI = getVertexAIForTask('docs');
    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-1.5-pro-002',
      generationConfig: {
        temperature: 0,
        candidateCount: 1,
      },
    });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: type }] }],
    });

    const content = response.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (content) {
      // Cache the fetched content
      docsCache.set(type, {
        content,
        timestamp: Date.now(),
      });
      return content;
    }

    throw new Error('No content received from Vertex AI');
  } catch (error: unknown) {
    // Log error but don't expose to client
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to fetch docs from Vertex AI: ${errorMessage}`);

    // Cache and return fallback content
    docsCache.set(type, {
      content: fallback,
      timestamp: Date.now(),
    });
    return fallback;
  }
}
