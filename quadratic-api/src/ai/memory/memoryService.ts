import type { AiMemoryEntityType, Prisma } from '@prisma/client';
import dbClient from '../../dbClient';
import { geminiai } from '../providers';

const SUMMARIZE_MODEL = 'gemini-2.0-flash';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

// --- Types ---

export interface MemoryPayload {
  sheets: SheetMemoryPayload[];
  codeCells: CodeCellMemoryPayload[];
}

export interface SheetMemoryPayload {
  name: string;
  bounds: string | null;
  dataTables: DataTableMemoryPayload[];
  codeTables: CodeTableMemoryPayload[];
  connections: ConnectionTableMemoryPayload[];
  charts: ChartMemoryPayload[];
}

export interface DataTableMemoryPayload {
  name: string;
  columns: string[];
  bounds: string;
}

export interface CodeTableMemoryPayload {
  name: string;
  language: string;
  columns: string[];
  bounds: string;
  code: string;
}

export interface ConnectionTableMemoryPayload {
  name: string;
  connectionKind: string;
  columns: string[];
  bounds: string;
  code: string;
}

export interface ChartMemoryPayload {
  name: string;
  language: string;
  bounds: string;
  code: string;
}

export interface CodeCellMemoryPayload {
  sheetName: string;
  position: string;
  language: string;
  code: string;
  outputShape: string | null;
  hasError: boolean;
  stdOut: string | null;
  stdErr: string | null;
}

// --- Embedding ---

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await geminiai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [{ text }],
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Unexpected embedding response: got ${values?.length ?? 0} dimensions, expected ${EMBEDDING_DIMENSIONS}`);
  }
  return values;
}

// --- Summarization ---

async function summarizeFile(payload: MemoryPayload, fileName: string): Promise<string> {
  let prompt = `Summarize this spreadsheet file named "${fileName}" in 2-4 sentences. Describe its purpose, the data it contains, and any analyses performed.\n\n`;

  for (const sheet of payload.sheets) {
    prompt += `Sheet "${sheet.name}"`;
    if (sheet.bounds) prompt += ` (bounds: ${sheet.bounds})`;
    prompt += ':\n';

    if (sheet.dataTables.length > 0) {
      prompt += `  Data tables: ${sheet.dataTables.map((t) => `${t.name} [${t.columns.join(', ')}] at ${t.bounds}`).join('; ')}\n`;
    }
    if (sheet.codeTables.length > 0) {
      prompt += `  Code tables: ${sheet.codeTables.map((t) => `${t.name} (${t.language}) at ${t.bounds}`).join('; ')}\n`;
    }
    if (sheet.connections.length > 0) {
      prompt += `  Connections: ${sheet.connections.map((t) => `${t.name} (${t.connectionKind}) at ${t.bounds}`).join('; ')}\n`;
    }
    if (sheet.charts.length > 0) {
      prompt += `  Charts: ${sheet.charts.map((t) => `${t.name} (${t.language})`).join('; ')}\n`;
    }
  }

  if (payload.codeCells.length > 0) {
    prompt += `\nCode cells:\n`;
    for (const cell of payload.codeCells) {
      prompt += `  - ${cell.language} at ${cell.sheetName}!${cell.position}`;
      if (cell.outputShape) prompt += ` → output: ${cell.outputShape}`;
      if (cell.hasError) prompt += ' [ERROR]';
      prompt += '\n';
    }
  }

  const result = await geminiai.models.generateContent({
    model: SUMMARIZE_MODEL,
    contents: prompt,
    config: {
      systemInstruction:
        'You are a concise summarizer for spreadsheet files. Produce a brief, informative summary that captures the purpose and key contents of the file. Focus on what data is present, what analyses or transformations are done, and what domain the file relates to.',
      temperature: 0.3,
      maxOutputTokens: 300,
    },
  });

  return result.text ?? 'Unable to generate summary.';
}

async function summarizeCodeCell(cell: CodeCellMemoryPayload): Promise<string> {
  const prompt = `Summarize what this ${cell.language} code cell does in 1-2 sentences. Describe its inputs, what transformation it performs, and its output.\n\nCode:\n\`\`\`\n${cell.code}\n\`\`\`\n${cell.outputShape ? `Output shape: ${cell.outputShape}` : ''}${cell.stdOut ? `\nStdout: ${cell.stdOut.slice(0, 500)}` : ''}${cell.stdErr ? `\nStderr: ${cell.stdErr.slice(0, 500)}` : ''}`;

  const result = await geminiai.models.generateContent({
    model: SUMMARIZE_MODEL,
    contents: prompt,
    config: {
      systemInstruction:
        'You are a concise code summarizer. Produce a brief summary of what the code does, focusing on inputs, transformations, and outputs. Be specific about data operations.',
      temperature: 0.3,
      maxOutputTokens: 200,
    },
  });

  return result.text ?? 'Unable to generate summary.';
}

// --- Upsert Memory ---

async function upsertMemory(args: {
  teamId: number;
  fileId: number | null;
  entityType: AiMemoryEntityType;
  entityId: string | null;
  title: string;
  summary: string;
  metadata?: Prisma.JsonValue;
}) {
  const { teamId, fileId, entityType, entityId, title, summary, metadata } = args;

  const embedding = await generateEmbedding(`${title}: ${summary}`);
  const embeddingStr = `[${embedding.join(',')}]`;

  // Use raw SQL for the upsert since Prisma doesn't support vector types natively
  await dbClient.$executeRaw`
    INSERT INTO ai_memory (team_id, file_id, entity_type, entity_id, title, summary, embedding, metadata, version, created_at, updated_at)
    VALUES (${teamId}, ${fileId}, ${entityType}::"AiMemoryEntityType", ${entityId}, ${title}, ${summary}, ${embeddingStr}::vector, ${JSON.stringify(metadata ?? {})}::jsonb, 1, NOW(), NOW())
    ON CONFLICT (team_id, file_id, entity_type, entity_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      version = ai_memory.version + 1,
      updated_at = NOW()
  `;
}

// --- Public API ---

/**
 * Generate and store AI memories from a MemoryPayload.
 * Creates a file-level summary and individual code cell summaries.
 */
export async function generateMemories(args: {
  teamId: number;
  fileId: number;
  fileName: string;
  payload: MemoryPayload;
}): Promise<void> {
  const { teamId, fileId, fileName, payload } = args;

  // Generate file summary
  const fileSummary = await summarizeFile(payload, fileName);
  await upsertMemory({
    teamId,
    fileId,
    entityType: 'FILE',
    entityId: null,
    title: fileName,
    summary: fileSummary,
    metadata: {
      sheetCount: payload.sheets.length,
      codeCellCount: payload.codeCells.length,
    },
  });

  // Generate code cell summaries (only for non-error cells with code)
  for (const cell of payload.codeCells) {
    if (cell.hasError || !cell.code.trim()) continue;

    const cellSummary = await summarizeCodeCell(cell);
    const cellTitle = `${cell.language} cell at ${cell.sheetName}!${cell.position}`;
    const entityId = `${cell.sheetName}:${cell.position}`;

    await upsertMemory({
      teamId,
      fileId,
      entityType: 'CODE_CELL',
      entityId,
      title: cellTitle,
      summary: cellSummary,
      metadata: {
        language: cell.language,
        position: cell.position,
        sheetName: cell.sheetName,
        outputShape: cell.outputShape,
      },
    });
  }
}

/**
 * Search memories using semantic similarity.
 */
export async function searchMemories(args: {
  teamId: number;
  query: string;
  limit?: number;
  entityType?: AiMemoryEntityType;
  fileId?: number;
}): Promise<
  Array<{
    id: number;
    teamId: number;
    fileId: number | null;
    entityType: string;
    entityId: string | null;
    title: string;
    summary: string;
    metadata: Prisma.JsonValue;
    pinned: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    similarity: number;
  }>
> {
  const { teamId, query, limit = 10, entityType, fileId } = args;

  const embedding = await generateEmbedding(query);
  const embeddingStr = `[${embedding.join(',')}]`;

  // Build dynamic WHERE clause fragments
  const entityTypeFilter = entityType ? `AND entity_type = '${entityType}'` : '';
  const fileIdFilter = fileId ? `AND file_id = ${fileId}` : '';

  const results = await dbClient.$queryRawUnsafe<
    Array<{
      id: number;
      team_id: number;
      file_id: number | null;
      entity_type: string;
      entity_id: string | null;
      title: string;
      summary: string;
      metadata: Prisma.JsonValue;
      pinned: boolean;
      version: number;
      created_at: Date;
      updated_at: Date;
      similarity: number;
    }>
  >(
    `SELECT id, team_id, file_id, entity_type, entity_id, title, summary, metadata, pinned, version, created_at, updated_at,
            1 - (embedding <=> '${embeddingStr}'::vector) as similarity
     FROM ai_memory
     WHERE team_id = ${teamId}
       AND embedding IS NOT NULL
       ${entityTypeFilter}
       ${fileIdFilter}
     ORDER BY embedding <=> '${embeddingStr}'::vector
     LIMIT ${limit}`
  );

  return results.map((r) => ({
    id: r.id,
    teamId: r.team_id,
    fileId: r.file_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    title: r.title,
    summary: r.summary,
    metadata: r.metadata,
    pinned: r.pinned,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    similarity: r.similarity,
  }));
}

/**
 * Generate and store a connection summary.
 */
export async function generateConnectionMemory(args: {
  teamId: number;
  connectionId: string;
  connectionName: string;
  connectionType: string;
  tables: string[];
}): Promise<void> {
  const { teamId, connectionId, connectionName, connectionType, tables } = args;

  const summary = `${connectionType} database connection "${connectionName}" providing access to ${tables.length} table(s): ${tables.slice(0, 20).join(', ')}${tables.length > 20 ? '...' : ''}.`;

  await upsertMemory({
    teamId,
    fileId: null,
    entityType: 'CONNECTION',
    entityId: connectionId,
    title: `${connectionType}: ${connectionName}`,
    summary,
    metadata: {
      connectionType,
      tableCount: tables.length,
      tables: tables.slice(0, 50),
    },
  });
}

/**
 * Generate and store a chat insight.
 */
export async function generateChatInsight(args: {
  teamId: number;
  fileId: number;
  chatId: string;
  messages: Array<{ role: string; content: string }>;
}): Promise<void> {
  const { teamId, fileId, chatId, messages } = args;

  const conversationText = messages
    .slice(0, 20)
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join('\n');

  const result = await geminiai.models.generateContent({
    model: SUMMARIZE_MODEL,
    contents: conversationText,
    config: {
      systemInstruction:
        'Extract the key knowledge, decisions, and solutions from this AI assistant conversation. Focus on domain-specific insights that would be useful for future reference. Be concise (2-3 sentences).',
      temperature: 0.3,
      maxOutputTokens: 200,
    },
  });

  const insight = result.text ?? 'Unable to extract insight.';

  await upsertMemory({
    teamId,
    fileId,
    entityType: 'CHAT_INSIGHT',
    entityId: chatId,
    title: 'Chat insight',
    summary: insight,
    metadata: { messageCount: messages.length },
  });
}
