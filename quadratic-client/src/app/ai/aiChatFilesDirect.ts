/**
 * Direct access to AI Chat Files IndexedDB
 *
 * This uses the same database as IframeAiChatFiles but without the iframe/postMessage layer.
 * Use this when you're on the same domain and don't need cross-origin communication.
 */

import type { DbFile } from '@/app/ai/iframeAiChatFiles/IframeMessages';
import { Dexie, type Table } from 'dexie';

// Must match IframeAiChatFiles constants
const DB_NAME = 'Iframe-AI-Chat-Files';
const DB_VERSION = 1;
const DB_STORE = 'iframeAiChatFiles';

type ChatFileKey = [string, string];

class AiChatFilesDirect {
  private db: Dexie;
  private filesTable: Table<DbFile, ChatFileKey>;

  constructor() {
    this.db = new Dexie(DB_NAME);
    this.db.version(DB_VERSION).stores({
      [DB_STORE]: '[chatId+fileId], chatId, fileId',
    });
    this.filesTable = this.db.table(DB_STORE);
  }

  /**
   * Save files to IndexedDB
   */
  async saveFiles(chatId: string, files: Array<{ name: string; type: string; size: number; data: ArrayBuffer }>) {
    const dbFiles: DbFile[] = files.map((file) => ({
      chatId,
      fileId: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type,
      lastModified: Date.now(),
      size: file.size,
      data: file.data,
    }));

    await this.filesTable.bulkPut(dbFiles);
    return dbFiles;
  }

  /**
   * Get files from IndexedDB by chatId
   */
  async getFiles(chatId: string): Promise<DbFile[]> {
    return this.filesTable.where('chatId').equals(chatId).toArray();
  }

  /**
   * Delete specific files
   */
  async deleteFiles(chatId: string, fileIds: string[]): Promise<void> {
    const keysToDelete = fileIds.map<ChatFileKey>((fileId) => [chatId, fileId]);
    await this.filesTable.bulkDelete(keysToDelete);
  }

  /**
   * Delete all files for a chatId
   */
  async deleteAllFiles(chatId: string): Promise<void> {
    await this.filesTable.where('chatId').equals(chatId).delete();
  }
}

export const aiChatFilesDirect = new AiChatFilesDirect();
