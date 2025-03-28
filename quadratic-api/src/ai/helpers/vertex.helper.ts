import type { VertexAI } from '@google-cloud/vertexai';
import { vertexaiByRegion } from '../providers';

type TaskType = 'docs' | 'chat' | 'analysis' | 'other';

export function getVertexAIForTask(taskType: string): VertexAI {
  // For now, use us-east5 for docs and us-central1 for other tasks
  const region = taskType === 'docs' ? 'us-east5' : 'us-central1';

  const instance = vertexaiByRegion[region];
  if (!instance) {
    throw new Error(`No Vertex AI instance available for region: ${region}`);
  }

  return instance;
}
