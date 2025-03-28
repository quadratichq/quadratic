import type { VertexAI } from '@google-cloud/vertexai';
import type { VertexAIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { vertexaiByRegion } from '../providers';

type TaskType = 'docs' | 'chat' | 'analysis' | 'other';

export function getVertexAIForTask(taskType: string, modelKey?: VertexAIModelKey): VertexAI {
  // Use us-central1 for custom endpoint and docs, us-east5 for other tasks
  const region =
    modelKey === 'vertexai:custom-endpoint-509017808567271424' || taskType === 'docs' ? 'us-central1' : 'us-east5';

  const instance = vertexaiByRegion[region];
  if (!instance) {
    throw new Error(`No Vertex AI instance available for region: ${region}`);
  }

  return instance;
}
