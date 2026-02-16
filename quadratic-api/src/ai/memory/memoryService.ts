import type { AiMemoryEntityType, AiMemoryScope, Prisma } from '@prisma/client';
import crypto from 'crypto';
import dbClient from '../../dbClient';
import { geminiai } from '../providers';

const SUMMARIZE_MODEL = 'gemini-2.0-flash';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

// --- Maintenance Counter ---

const MAINTENANCE_THRESHOLD = 50;
const teamWriteCounter = new Map<number, number>();

/**
 * Run maintenance if enough writes have accumulated for this team.
 * Fires in the background without blocking the caller.
 */
function maybeRunMaintenance(teamId: number): void {
  const count = teamWriteCounter.get(teamId) ?? 0;
  if (count < MAINTENANCE_THRESHOLD) return;

  teamWriteCounter.set(teamId, 0);

  // Fire-and-forget
  import('./memoryMaintenance')
    .then(({ runMaintenance }) => runMaintenance(teamId))
    .catch((err) => {
      console.error('[ai-memory] Maintenance failed:', err);
    });
}

// --- Types ---

export interface MemoryPayload {
  sheets: SheetMemoryPayload[];
  codeCells: CodeCellMemoryPayload[];
  sheetTables: SheetTableMemoryPayload[];
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
  name?: string;
  language: string;
  code: string;
  outputShape: string | null;
  hasError: boolean;
  stdOut: string | null;
  stdErr: string | null;
}

export interface SheetTableMemoryPayload {
  sheetName: string;
  bounds: string;
  columns: string[];
  rows: number;
  cols: number;
}

export interface ChatInsightMessage {
  role: string;
  content: string;
  hasToolCalls?: boolean;
  toolNames?: string[];
}

export interface TopicExtraction {
  primaryTopic: string;
  relatedConcepts: string[];
  knowledgeType: 'insight' | 'decision' | 'pattern' | 'solution';
  summary: string;
  scope: 'file' | 'team';
}

export interface CodeCellAnalysis {
  summary: string;
  concepts: string[];
  patterns: string[];
}

export interface MemoryRecord {
  id: number;
  teamId: number;
  fileId: number | null;
  entityType: string;
  entityId: string;
  scope: string;
  topic: string | null;
  title: string;
  summary: string;
  metadata: Prisma.JsonValue;
  pinned: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  similarity: number;
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
    throw new Error(
      `Unexpected embedding response: got ${values?.length ?? 0} dimensions, expected ${EMBEDDING_DIMENSIONS}`
    );
  }
  return values;
}

// --- Summarization ---

/**
 * Determine whether a file is complex enough to warrant its own FILE-level memory.
 * Simple files (e.g., one code cell, no data tables) are fully represented by
 * their code cell memories and don't need a separate file summary.
 */
function fileNeedsOwnSummary(payload: MemoryPayload): boolean {
  const totalDataTables = payload.sheets.reduce((sum, s) => sum + s.dataTables.length, 0);
  const totalConnections = payload.sheets.reduce((sum, s) => sum + s.connections.length, 0);
  const totalCharts = payload.sheets.reduce((sum, s) => sum + s.charts.length, 0);
  const totalSheetTables = payload.sheetTables.length;
  const nonErrorCodeCells = payload.codeCells.filter((c) => !c.hasError && c.code.trim()).length;

  // Skip file summary if the file only has a single code cell and nothing else
  if (
    nonErrorCodeCells <= 1 &&
    totalDataTables === 0 &&
    totalConnections === 0 &&
    totalCharts === 0 &&
    totalSheetTables === 0
  ) {
    return false;
  }

  return true;
}

async function summarizeFile(payload: MemoryPayload, fileName: string): Promise<string> {
  let prompt = `Summarize this spreadsheet file named "${fileName}" in 2-4 sentences (max 80 words). Focus on the overall purpose of the file, what domain it relates to, and how its components work together.\n\n`;

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

  if (payload.sheetTables.length > 0) {
    prompt += `\nInline data regions (${payload.sheetTables.length} total):\n`;
    for (const table of payload.sheetTables) {
      prompt += `  - ${table.sheetName}!${table.bounds} (${table.rows} rows x ${table.cols} cols), columns: ${table.columns.join(', ')}\n`;
    }
  }

  if (payload.codeCells.length > 0) {
    prompt += `\nCode cells (${payload.codeCells.length} total):\n`;
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
        'You are a concise summarizer for spreadsheet files. Describe the overall purpose of the file, what domain it serves, and how its data and analyses relate to each other. Do NOT describe what individual code cells do in detail -- those are summarized separately. Focus on the big picture: what this file is for and what data it contains. Stay under 80 words.',
      temperature: 0.3,
      maxOutputTokens: 400,
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

// --- Code Cell Analysis ---

/**
 * Analyze a code cell to extract concepts and patterns for linking to the knowledge network.
 */
async function analyzeCodeCell(cell: CodeCellMemoryPayload): Promise<CodeCellAnalysis> {
  const prompt = `Analyze this ${cell.language} code cell and extract:
1. A 1-2 sentence summary of what it does (max 40 words)
2. Key concepts it involves (e.g., "revenue calculation", "date aggregation")
3. Reusable patterns it implements (e.g., "monthly rollup", "YoY comparison")

Code:
\`\`\`
${cell.code}
\`\`\`
${cell.outputShape ? `Output shape: ${cell.outputShape}` : ''}

Respond in JSON format:
{
  "summary": "...",
  "concepts": ["concept1", "concept2"],
  "patterns": ["pattern1", "pattern2"]
}

If there are no notable patterns, use an empty array. Keep concepts and patterns concise (2-4 words each). Keep summary under 40 words.`;

  const result = await geminiai.models.generateContent({
    model: SUMMARIZE_MODEL,
    contents: prompt,
    config: {
      systemInstruction: 'You are a code analyzer. Output valid JSON only.',
      responseMimeType: 'application/json',
      temperature: 0.3,
      maxOutputTokens: 500,
    },
  });

  const text = result.text ?? '';
  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary ?? 'Unable to generate summary.',
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts.slice(0, 5) : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns.slice(0, 5) : [],
    };
  } catch {
    return { summary: text.slice(0, 200), concepts: [], patterns: [] };
  }
}

// --- Quality Filtering ---

/**
 * Determine whether a conversation is worth generating an insight for.
 * Uses fast heuristics before any LLM call to save costs.
 */
export function shouldGenerateInsight(messages: ChatInsightMessage[]): { generate: boolean; reason: string } {
  // Must have at least 2 substantive messages (not just tool calls)
  const substantiveMessages = messages.filter(
    (m) => m.content.length > 50 && !(m.hasToolCalls && m.content.length < 20)
  );
  if (substantiveMessages.length < 2) {
    return { generate: false, reason: 'trivial_conversation' };
  }

  // Check tool-call ratio: if >80% of messages are pure tool executions, skip
  const toolOnlyMessages = messages.filter((m) => m.hasToolCalls && m.content.length < 20);
  if (messages.length > 0 && toolOnlyMessages.length / messages.length > 0.8) {
    return { generate: false, reason: 'pure_tool_execution' };
  }

  // Must have at least one assistant message with explanation (not just tool calls)
  const assistantWithText = messages.filter((m) => m.role === 'assistant' && m.content.length > 100);
  if (assistantWithText.length === 0) {
    return { generate: false, reason: 'no_substantive_response' };
  }

  return { generate: true, reason: 'valuable' };
}

// --- Topic Extraction ---

/**
 * Extract topic, concepts, and knowledge from a conversation.
 * Returns null if the conversation is trivial.
 */
export async function extractTopicAndKnowledge(messages: ChatInsightMessage[]): Promise<TopicExtraction | null> {
  const conversationText = messages
    .slice(0, 20)
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join('\n');

  const result = await geminiai.models.generateContent({
    model: SUMMARIZE_MODEL,
    contents: conversationText,
    config: {
      systemInstruction: `Analyze this AI assistant conversation and extract structured knowledge.

Your task:
1. Identify the PRIMARY TOPIC being discussed (be specific but not overly narrow)
2. List related concepts that connect to other potential knowledge
3. Classify the type: insight, decision, pattern, or solution
4. Write a summary focusing on WHAT WAS LEARNED, not what was done (max 50 words)
5. Determine scope: "file" if the knowledge is specific to this file's data, "team" if it's a reusable pattern/concept/decision

SKIP if the conversation is:
- Simple task execution ("add trend line", "change color", "format cells")
- Generic questions with generic answers
- Troubleshooting that resolved without explanation

If not worth saving, respond with: {"skip": true}

Otherwise respond with:
{
  "skip": false,
  "primaryTopic": "Customer Churn Prediction",
  "relatedConcepts": ["retention metrics", "ML classification"],
  "knowledgeType": "solution",
  "summary": "Used logistic regression with 90-day activity features...",
  "scope": "team"
}`,
      responseMimeType: 'application/json',
      temperature: 0.3,
      maxOutputTokens: 500,
    },
  });

  const text = result.text?.trim() ?? '';
  try {
    const parsed = JSON.parse(text);
    if (parsed.skip) {
      return null;
    }
    return {
      primaryTopic: parsed.primaryTopic ?? 'General',
      relatedConcepts: Array.isArray(parsed.relatedConcepts) ? parsed.relatedConcepts.slice(0, 5) : [],
      knowledgeType: parsed.knowledgeType ?? 'insight',
      summary: parsed.summary ?? text.slice(0, 200),
      scope: parsed.scope === 'team' ? 'team' : 'file',
    };
  } catch {
    return null;
  }
}

// --- Topic Similarity ---

/**
 * Find an existing memory with a similar topic.
 * Returns the best match above the threshold, or null.
 */
export async function findSimilarTopicMemory(
  teamId: number,
  topic: string,
  threshold: number = 0.85
): Promise<MemoryRecord | null> {
  const topicEmbedding = await generateEmbedding(topic);
  const embeddingStr = `[${topicEmbedding.join(',')}]`;

  const results = await dbClient.$queryRawUnsafe<
    Array<{
      id: number;
      team_id: number;
      file_id: number | null;
      entity_type: string;
      entity_id: string;
      scope: string;
      topic: string | null;
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
    `SELECT id, team_id, file_id, entity_type, entity_id, scope, topic, title, summary, metadata, pinned, version, created_at, updated_at,
            1 - (embedding <=> '${embeddingStr}'::vector) as similarity
     FROM ai_memory
     WHERE team_id = ${teamId}
       AND entity_type = 'CHAT_INSIGHT'
       AND embedding IS NOT NULL
     ORDER BY embedding <=> '${embeddingStr}'::vector
     LIMIT 1`
  );

  if (results.length === 0 || results[0].similarity < threshold) {
    return null;
  }

  const r = results[0];
  return {
    id: r.id,
    teamId: r.team_id,
    fileId: r.file_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    scope: r.scope,
    topic: r.topic,
    title: r.title,
    summary: r.summary,
    metadata: r.metadata,
    pinned: r.pinned,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    similarity: r.similarity,
  };
}

// --- Knowledge Merging ---

/**
 * Merge new knowledge into an existing memory's summary.
 */
export async function mergeKnowledge(existing: MemoryRecord, newExtraction: TopicExtraction): Promise<string> {
  const result = await geminiai.models.generateContent({
    model: SUMMARIZE_MODEL,
    contents: `EXISTING KNOWLEDGE:
Topic: ${existing.topic}
Summary: ${existing.summary}

NEW INFORMATION from recent conversation:
${newExtraction.summary}`,
    config: {
      systemInstruction: `You are updating a team knowledge base entry.

Your task:
1. If the new information adds value, merge it into a cohesive updated summary
2. If it contradicts existing knowledge, note the update/correction
3. If it's redundant, keep the existing summary unchanged
4. Keep the summary concise (3-5 sentences, max 100 words)

Output the updated summary only, no other text. Stay under 100 words.`,
      temperature: 0.3,
      maxOutputTokens: 400,
    },
  });

  return result.text ?? existing.summary;
}

// --- Upsert Memory ---

/**
 * Upsert a memory record and return its ID.
 */
export async function upsertMemory(args: {
  teamId: number;
  fileId: number | null;
  entityType: AiMemoryEntityType;
  entityId: string;
  scope?: AiMemoryScope;
  topic?: string | null;
  title: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<number> {
  const { teamId, fileId, entityType, entityId, title, summary, metadata } = args;
  const scope = args.scope ?? 'file';
  const topic = args.topic ?? null;

  const embedding = await generateEmbedding(`${title}: ${summary}`);
  const embeddingStr = `[${embedding.join(',')}]`;

  const result = await dbClient.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO ai_memory (team_id, file_id, entity_type, entity_id, scope, topic, title, summary, embedding, metadata, version, created_at, updated_at)
     VALUES ($1, $2, $3::"AiMemoryEntityType", $4, $5::"AiMemoryScope", $6, $7, $8, $9::vector, $10::jsonb, 1, NOW(), NOW())
     ON CONFLICT (team_id, COALESCE(file_id, -1), entity_type, entity_id)
     DO UPDATE SET
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       embedding = EXCLUDED.embedding,
       metadata = EXCLUDED.metadata,
       scope = EXCLUDED.scope,
       topic = EXCLUDED.topic,
       version = ai_memory.version + 1,
       updated_at = NOW()
     RETURNING id`,
    teamId,
    fileId,
    entityType,
    entityId,
    scope,
    topic,
    title,
    summary,
    embeddingStr,
    JSON.stringify(metadata ?? {})
  );

  // Track writes for maintenance scheduling
  teamWriteCounter.set(teamId, (teamWriteCounter.get(teamId) ?? 0) + 1);

  return result[0].id;
}

// --- Content Fingerprinting ---

const MAX_PREVIOUS_SUMMARIES = 5;

function computeContentHash(entityType: string, data: Record<string, unknown>): string {
  let input: string;
  switch (entityType) {
    case 'CODE_CELL':
      input = `${data.code}|${data.language}|${data.outputShape ?? ''}`;
      break;
    case 'DATA_TABLE':
      input = `${data.name}|${(data.columns as string[]).slice().sort().join(',')}|${data.bounds}`;
      break;
    case 'SHEET_TABLE':
      input = `${(data.columns as string[]).join(',')}|${data.bounds}|${data.rows}|${data.cols}`;
      break;
    case 'FILE':
      input = `${data.sheetNames}|${data.codeCellCount}|${data.dataTableCount}|${data.sheetTableCount}`;
      break;
    default:
      input = JSON.stringify(data);
  }
  return crypto.createHash('md5').update(input).digest('hex');
}

function pushPreviousSummary(metadata: Record<string, unknown>, oldSummary: string): Prisma.InputJsonValue {
  const previous: Array<{ summary: string; updatedAt: string }> = Array.isArray(metadata.previousSummaries)
    ? (metadata.previousSummaries as Array<{ summary: string; updatedAt: string }>)
    : [];
  previous.push({ summary: oldSummary, updatedAt: new Date().toISOString() });
  // Keep only the most recent entries
  while (previous.length > MAX_PREVIOUS_SUMMARIES) {
    previous.shift();
  }
  return {
    ...metadata,
    previousSummaries: previous.map((p) => ({ summary: p.summary, updatedAt: p.updatedAt })),
  } as Prisma.InputJsonValue;
}

// --- Public API ---

interface ExistingMemoryRecord {
  id: number;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: Prisma.JsonValue;
}

/**
 * Generate and store AI memories from a MemoryPayload.
 * Uses reconciliation: compares content fingerprints against existing memories
 * and only re-summarizes entities that have actually changed. Deletes memories
 * for entities that no longer exist in the payload.
 */
export async function generateMemories(args: {
  teamId: number;
  fileId: number;
  fileName: string;
  payload: MemoryPayload;
}): Promise<void> {
  const { teamId, fileId, fileName, payload } = args;

  // Fetch all existing file-scoped memories for this file
  const existingMemories = await dbClient.aiMemory.findMany({
    where: {
      teamId,
      fileId,
      entityType: { in: ['FILE', 'CODE_CELL', 'DATA_TABLE', 'SHEET_TABLE'] },
    },
    select: { id: true, entityType: true, entityId: true, summary: true, metadata: true },
  });

  // Build lookup: "entityType:entityId" -> existing memory
  const existingMap = new Map<string, ExistingMemoryRecord>();
  for (const mem of existingMemories) {
    const key = `${mem.entityType}:${mem.entityId ?? ''}`;
    existingMap.set(key, mem);
  }

  // Track which entity keys are present in the new payload
  const newEntityKeys = new Set<string>();

  // --- FILE memory ---
  if (fileNeedsOwnSummary(payload)) {
    const fileKey = 'FILE:';
    newEntityKeys.add(fileKey);
    const fileHash = computeContentHash('FILE', {
      sheetNames: payload.sheets.map((s) => s.name).join(','),
      codeCellCount: payload.codeCells.length,
      dataTableCount: payload.sheets.reduce((sum, s) => sum + s.dataTables.length, 0),
      sheetTableCount: payload.sheetTables.length,
    });
    const existing = existingMap.get(fileKey);
    const existingHash = existing ? ((existing.metadata as Record<string, unknown>)?.contentHash as string) : undefined;

    if (!existing || existingHash !== fileHash) {
      const fileSummary = await summarizeFile(payload, fileName);
      let metadata: Prisma.InputJsonValue = {
        sheetCount: payload.sheets.length,
        codeCellCount: payload.codeCells.length,
        contentHash: fileHash,
      };
      if (existing) {
        metadata = pushPreviousSummary(metadata as Record<string, unknown>, existing.summary);
      }
      await upsertMemory({
        teamId,
        fileId,
        entityType: 'FILE',
        entityId: '',
        scope: 'file',
        title: fileName,
        summary: fileSummary,
        metadata,
      });
    }
  }

  // --- DATA_TABLE memories ---
  for (const sheet of payload.sheets) {
    for (const table of sheet.dataTables) {
      const entityId = `${sheet.name}:${table.bounds}`;
      const entityKey = `DATA_TABLE:${entityId}`;
      newEntityKeys.add(entityKey);

      const hash = computeContentHash('DATA_TABLE', {
        name: table.name,
        columns: table.columns,
        bounds: table.bounds,
      });
      const existing = existingMap.get(entityKey);
      const existingHash = existing
        ? ((existing.metadata as Record<string, unknown>)?.contentHash as string)
        : undefined;

      if (!existing || existingHash !== hash) {
        const columnList = table.columns.join(', ');
        const summary = `Imported data table "${table.name}" at ${sheet.name}!${table.bounds} with columns: ${columnList}.`;
        let metadata: Prisma.InputJsonValue = {
          columns: table.columns,
          bounds: table.bounds,
          sheetName: sheet.name,
          contentHash: hash,
        };
        if (existing) {
          metadata = pushPreviousSummary(metadata as Record<string, unknown>, existing.summary);
        }
        await upsertMemory({
          teamId,
          fileId,
          entityType: 'DATA_TABLE',
          entityId,
          scope: 'file',
          topic: table.name,
          title: table.name,
          summary,
          metadata,
        });
      }
    }
  }

  // --- SHEET_TABLE memories ---
  for (const table of payload.sheetTables) {
    const entityId = `${table.sheetName}:${table.bounds}`;
    const entityKey = `SHEET_TABLE:${entityId}`;
    newEntityKeys.add(entityKey);

    const hash = computeContentHash('SHEET_TABLE', {
      columns: table.columns,
      bounds: table.bounds,
      rows: table.rows,
      cols: table.cols,
    });
    const existing = existingMap.get(entityKey);
    const existingHash = existing ? ((existing.metadata as Record<string, unknown>)?.contentHash as string) : undefined;

    if (!existing || existingHash !== hash) {
      const columnList = table.columns.join(', ');
      const title =
        table.columns.length > 0 && table.columns[0]
          ? `Table: ${table.columns.slice(0, 3).join(', ')}${table.columns.length > 3 ? '...' : ''}`
          : `Table at ${table.sheetName}!${table.bounds}`;
      const summary = `Inline data at ${table.sheetName}!${table.bounds} (${table.rows} rows x ${table.cols} cols). First row: ${columnList}.`;
      let metadata: Prisma.InputJsonValue = {
        columns: table.columns,
        bounds: table.bounds,
        sheetName: table.sheetName,
        rows: table.rows,
        cols: table.cols,
        contentHash: hash,
      };
      if (existing) {
        metadata = pushPreviousSummary(metadata as Record<string, unknown>, existing.summary);
      }
      await upsertMemory({
        teamId,
        fileId,
        entityType: 'SHEET_TABLE',
        entityId,
        scope: 'file',
        topic: title,
        title,
        summary,
        metadata,
      });
    }
  }

  // --- CODE_CELL memories ---
  for (const cell of payload.codeCells) {
    if (cell.hasError || !cell.code.trim()) continue;

    const entityId = `${cell.sheetName}:${cell.position}`;
    const entityKey = `CODE_CELL:${entityId}`;
    newEntityKeys.add(entityKey);

    const hash = computeContentHash('CODE_CELL', {
      code: cell.code,
      language: cell.language,
      outputShape: cell.outputShape,
    });
    const existing = existingMap.get(entityKey);
    const existingHash = existing ? ((existing.metadata as Record<string, unknown>)?.contentHash as string) : undefined;

    if (!existing || existingHash !== hash) {
      const analysis = await analyzeCodeCell(cell);
      const cellTitle = cell.name?.trim() || `${cell.language} cell at ${cell.sheetName}!${cell.position}`;
      let metadata: Prisma.InputJsonValue = {
        language: cell.language,
        position: cell.position,
        sheetName: cell.sheetName,
        outputShape: cell.outputShape,
        concepts: analysis.concepts,
        patterns: analysis.patterns,
        contentHash: hash,
      };
      if (existing) {
        metadata = pushPreviousSummary(metadata as Record<string, unknown>, existing.summary);
      }
      await upsertMemory({
        teamId,
        fileId,
        entityType: 'CODE_CELL',
        entityId,
        scope: 'file',
        topic: analysis.concepts[0] ?? null,
        title: cellTitle,
        summary: analysis.summary,
        metadata,
      });
    }
  }

  // --- Delete orphaned memories (entities removed from the grid) ---
  const orphanIds: number[] = [];
  for (const [key, mem] of existingMap) {
    if (!newEntityKeys.has(key)) {
      orphanIds.push(mem.id);
    }
  }
  if (orphanIds.length > 0) {
    await dbClient.aiMemory.deleteMany({
      where: { id: { in: orphanIds } },
    });
  }

  // Run maintenance if enough writes have accumulated
  maybeRunMaintenance(teamId);
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
  scope?: AiMemoryScope;
  minSimilarity?: number;
  excludeIds?: number[];
}): Promise<MemoryRecord[]> {
  const { teamId, query, limit = 10, entityType, fileId, scope, minSimilarity, excludeIds } = args;

  const embedding = await generateEmbedding(query);
  const embeddingStr = `[${embedding.join(',')}]`;

  // Build dynamic WHERE clause fragments
  const filters: string[] = [`team_id = ${teamId}`, 'embedding IS NOT NULL'];
  if (entityType) filters.push(`entity_type = '${entityType}'`);
  if (fileId) filters.push(`file_id = ${fileId}`);
  if (scope) filters.push(`scope = '${scope}'`);
  if (excludeIds && excludeIds.length > 0) filters.push(`id NOT IN (${excludeIds.join(',')})`);

  const whereClause = filters.join(' AND ');
  const havingClause = minSimilarity ? `HAVING 1 - (embedding <=> '${embeddingStr}'::vector) >= ${minSimilarity}` : '';

  const results = await dbClient.$queryRawUnsafe<
    Array<{
      id: number;
      team_id: number;
      file_id: number | null;
      entity_type: string;
      entity_id: string;
      scope: string;
      topic: string | null;
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
    `SELECT id, team_id, file_id, entity_type, entity_id, scope, topic, title, summary, metadata, pinned, version, created_at, updated_at,
            1 - (embedding <=> '${embeddingStr}'::vector) as similarity
     FROM ai_memory
     WHERE ${whereClause}
     ${havingClause ? `AND 1 - (embedding <=> '${embeddingStr}'::vector) >= ${minSimilarity}` : ''}
     ORDER BY embedding <=> '${embeddingStr}'::vector
     LIMIT ${limit}`
  );

  return results.map((r) => ({
    id: r.id,
    teamId: r.team_id,
    fileId: r.file_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    scope: r.scope,
    topic: r.topic,
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
    scope: 'team',
    topic: `${connectionType}: ${connectionName}`,
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
 * Delete all file-scoped memories (FILE, CODE_CELL, DATA_TABLE, SHEET_TABLE) for a given file.
 * Used when a file is permanently deleted. For regeneration, use generateMemories()
 * which reconciles in-place instead of deleting.
 */
export async function deleteFileMemories(teamId: number, fileId: number): Promise<number> {
  const result = await dbClient.aiMemory.deleteMany({
    where: {
      teamId,
      fileId,
      entityType: { in: ['FILE', 'CODE_CELL', 'DATA_TABLE', 'SHEET_TABLE'] },
    },
  });
  return result.count;
}

/**
 * Update the title (filename) of a FILE entity memory and regenerate its embedding.
 * Called when a file is renamed.
 */
export async function updateFileMemoryTitle(args: {
  teamId: number;
  fileId: number;
  newFileName: string;
}): Promise<void> {
  const { teamId, fileId, newFileName } = args;

  const existingMemory = await dbClient.$queryRaw<
    Array<{ id: number; summary: string }>
  >`SELECT id, summary FROM ai_memory WHERE team_id = ${teamId} AND file_id = ${fileId} AND entity_type = 'FILE' AND entity_id = '' LIMIT 1`;

  if (existingMemory.length === 0) {
    return;
  }

  const { summary } = existingMemory[0];

  const embedding = await generateEmbedding(`${newFileName}: ${summary}`);
  const embeddingStr = `[${embedding.join(',')}]`;

  await dbClient.$executeRaw`
    UPDATE ai_memory
    SET title = ${newFileName},
        embedding = ${embeddingStr}::vector,
        version = version + 1,
        updated_at = NOW()
    WHERE team_id = ${teamId}
      AND file_id = ${fileId}
      AND entity_type = 'FILE'
      AND entity_id = ''
  `;
}

/**
 * Generate a topic-based hash for use as entity ID for chat insights.
 */
function topicHash(topic: string): string {
  return crypto.createHash('md5').update(topic.toLowerCase().trim()).digest('hex').slice(0, 16);
}

/**
 * Generate and store a chat insight organized by topic.
 * Performs quality filtering, topic extraction, and merges with existing
 * topic-based memories instead of creating one insight per chat.
 */
export async function generateChatInsight(args: {
  teamId: number;
  fileId: number;
  chatId: string;
  messages: ChatInsightMessage[];
}): Promise<void> {
  const { teamId, fileId, messages } = args;

  // Quality filter: skip trivial conversations
  const quality = shouldGenerateInsight(messages);
  if (!quality.generate) {
    console.log(`[ai-memory] Skipping chat insight: ${quality.reason}`);
    return;
  }

  // Extract topic and knowledge
  const extraction = await extractTopicAndKnowledge(messages);
  if (!extraction) {
    console.log('[ai-memory] Skipping chat insight: LLM determined not worth saving');
    return;
  }

  // Check for existing memory with the same topic
  const existing = await findSimilarTopicMemory(teamId, extraction.primaryTopic);

  let finalSummary: string;
  let entityId: string;
  let metadata: Prisma.InputJsonValue = {
    knowledgeType: extraction.knowledgeType,
    relatedConcepts: extraction.relatedConcepts,
    messageCount: messages.length,
  };

  if (existing) {
    // Preserve old summary in version history before merging
    const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;
    metadata = pushPreviousSummary({ ...(metadata as Record<string, unknown>), ...existingMeta }, existing.summary);
    finalSummary = await mergeKnowledge(existing, extraction);
    entityId = existing.entityId || `topic:${topicHash(extraction.primaryTopic)}`;
  } else {
    finalSummary = extraction.summary;
    entityId = `topic:${topicHash(extraction.primaryTopic)}`;
  }

  await upsertMemory({
    teamId,
    fileId: extraction.scope === 'team' ? null : fileId,
    entityType: 'CHAT_INSIGHT',
    entityId,
    scope: extraction.scope,
    topic: extraction.primaryTopic,
    title: extraction.primaryTopic,
    summary: finalSummary,
    metadata,
  });
}
