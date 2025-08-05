import { sendAnalyticsError } from '@/shared/utils/error';
import { Dexie, type Table } from 'dexie';
import { getPromptAndInternalMessages } from 'quadratic-shared/ai/helpers/message.helper';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import { ChatSchema } from 'quadratic-shared/typesAndSchemasAI';

const DB_NAME = 'Quadratic-AI';
const DB_VERSION = 1;
const DB_STORE = 'aiAnalystChats';

interface ChatEntry extends Chat {
  userEmail: string;
  fileId: string;
}

// [userEmail, fileId, chatId]
type ChatEntryKey = [string, string, string];

class AIAnalystOfflineChats {
  private db?: Dexie;
  private chatsTable?: Table<ChatEntry, ChatEntryKey>;
  userEmail?: string;
  fileId?: string;

  private sendAnalyticsError = (from: string, error: Error | unknown) => {
    sendAnalyticsError('aiAnalystOfflineChats', from, error);
  };

  init = async (userEmail: string, fileId: string): Promise<void> => {
    try {
      this.userEmail = userEmail;
      this.fileId = fileId;

      this.db = new Dexie(DB_NAME);
      this.db.version(DB_VERSION).stores({
        [DB_STORE]: '[userEmail+fileId+id], userEmail, fileId',
      });

      this.chatsTable = this.db.table(DB_STORE);

      await this.db.open();
    } catch (error) {
      this.sendAnalyticsError('init', error);
    }
  };

  // Helper method to validate required properties
  private validateState = (methodName: string) => {
    if (!this.db || !this.chatsTable || !this.userEmail || !this.fileId) {
      throw new Error(`Expected db, userEmail and fileId to be set in ${methodName} method.`);
    }

    return {
      db: this.db,
      chatsTable: this.chatsTable,
      userEmail: this.userEmail,
      fileId: this.fileId,
    };
  };

  // Load all chats for current user and file
  loadChats = async (): Promise<Chat[]> => {
    try {
      const { chatsTable, userEmail, fileId } = this.validateState('loadChats');

      const chatEntries = await chatsTable.where({ userEmail, fileId }).toArray();

      const chats = chatEntries.reduce((acc: Chat[], chatEntry) => {
        const { userEmail, fileId, ...chat } = chatEntry;
        const parsedChat = ChatSchema.safeParse(chat);
        if (parsedChat.success) {
          acc.push(parsedChat.data);
        } else {
          // delete chat if it is not valid or schema has changed
          this.deleteChats([chat.id]).catch((error) => {
            console.error('[AIAnalystOfflineChats] loadChats: ', error);
          });
        }
        return acc;
      }, []);

      return chats;
    } catch (error) {
      this.sendAnalyticsError('loadChats', error);
      return [];
    }
  };

  // Save or update a chat
  saveChats = async (chats: Chat[]) => {
    try {
      const { chatsTable, userEmail, fileId } = this.validateState('saveChats');

      const chatEntries: ChatEntry[] = chats.map((chat) => ({
        userEmail,
        fileId,
        ...{
          ...chat,
          messages: getPromptAndInternalMessages(chat.messages),
        },
      }));

      await chatsTable.bulkPut(chatEntries);
    } catch (error) {
      this.sendAnalyticsError('saveChats', error);
    }
  };

  // Delete a list of chats
  deleteChats = async (chatIds: string[]) => {
    try {
      const { chatsTable, userEmail, fileId } = this.validateState('deleteChats');

      const keys = chatIds.map<ChatEntryKey>((chatId) => [userEmail, fileId, chatId]);
      await chatsTable.bulkDelete(keys);
    } catch (error) {
      this.sendAnalyticsError('deleteChats', error);
    }
  };

  // Delete all chats for a file
  deleteFile = async (userEmail: string, fileId: string) => {
    try {
      if (this.userEmail !== userEmail || this.fileId !== fileId) {
        await this.init(userEmail, fileId);
      }

      const chats = await this.loadChats();
      if (!chats) {
        return;
      }

      const chatIds = chats.map((chat) => chat.id);

      await this.deleteChats(chatIds);
    } catch (error) {
      this.sendAnalyticsError('deleteFile', error);
    }
  };

  // Used by tests to clear all entries from the indexedDb
  testClear = async () => {
    const { chatsTable } = this.validateState('testClear');

    await chatsTable.clear();
  };
}

export const aiAnalystOfflineChats = new AIAnalystOfflineChats();
