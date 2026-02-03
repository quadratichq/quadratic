import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import 'fake-indexeddb/auto';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_BACKUP_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import { v4 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { aiAnalystOfflineChats } from './aiAnalystChats';

describe('aiAnalystOfflineChats', () => {
  beforeAll(async () => {
    await aiAnalystOfflineChats.init('test@test.com', 'test-fileId');
  });

  beforeEach(async () => {
    await aiAnalystOfflineChats.testClear();
  });

  it('properly defines user email and fileId', () => {
    expect(aiAnalystOfflineChats).toBeDefined();
    expect(aiAnalystOfflineChats.userEmail).toBe('test@test.com');
    expect(aiAnalystOfflineChats.fileId).toBe('test-fileId');
  });

  it('loads empty chats', async () => {
    expect(await aiAnalystOfflineChats.loadChats()).toStrictEqual([]);
  });

  it('saves and loads chats', async () => {
    const testChats: Chat[] = [
      {
        id: v4(),
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [
          { role: 'user', content: [createTextContent('test1')], contextType: 'quadraticDocs' },
          {
            role: 'assistant',
            content: [createTextContent('response1')],
            contextType: 'quadraticDocs',
          },
        ],
      },
      {
        id: v4(),
        name: 'Chat 2',
        lastUpdated: Date.now(),
        messages: [
          {
            role: 'user',
            content: [createTextContent('test2')],
            contextType: 'userPrompt',
            context: defaultAIAnalystContext,
          },
          {
            role: 'assistant',
            content: [createTextContent('response2')],
            contextType: 'userPrompt',
            toolCalls: [],
            modelKey: DEFAULT_BACKUP_MODEL,
          },
        ],
      },
    ];

    await aiAnalystOfflineChats.saveChats(testChats);
    const loadedChats = await aiAnalystOfflineChats.loadChats();

    expect(loadedChats.length).toBe(2);
    const testChat1 = loadedChats.find((chat) => chat.id === testChats[0].id);
    const testChat2 = loadedChats.find((chat) => chat.id === testChats[1].id);
    expect(testChat1).toBeDefined();
    expect(testChat2).toBeDefined();
    expect(testChat1?.name).toBe('Chat 1');
    expect(testChat1?.messages.length).toBe(0); // Only userPrompt messages are stored
    expect(testChat2?.name).toBe('Chat 2');
    expect(testChat2?.messages[0].content).toEqual([createTextContent('test2')]);
    expect(testChat2?.messages[1].content).toEqual([createTextContent('response2')]);
  });

  it('deletes chats', async () => {
    const testChats: Chat[] = [
      {
        id: v4(),
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [
          {
            role: 'user',
            content: [createTextContent('test1')],
            contextType: 'userPrompt',
            context: defaultAIAnalystContext,
          },
        ],
      },
      {
        id: v4(),
        name: 'Chat 2',
        lastUpdated: Date.now(),
        messages: [
          {
            role: 'user',
            content: [createTextContent('test2')],
            contextType: 'userPrompt',
            context: defaultAIAnalystContext,
          },
        ],
      },
      {
        id: v4(),
        name: 'Chat 3',
        lastUpdated: Date.now(),
        messages: [
          {
            role: 'user',
            content: [createTextContent('test3')],
            contextType: 'userPrompt',
            context: defaultAIAnalystContext,
          },
        ],
      },
    ];

    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(3);

    await aiAnalystOfflineChats.deleteChats([testChats[1].id]);

    const loadedChats = await aiAnalystOfflineChats.loadChats();
    expect(loadedChats.length).toBe(2);
    const testChat1 = loadedChats.find((chat) => chat.id === testChats[0].id);
    const testChat2 = loadedChats.find((chat) => chat.id === testChats[2].id);
    expect(testChat1).toBeDefined();
    expect(testChat2).toBeDefined();
    expect(testChat1?.id).toBe(testChats[0].id);
    expect(testChat2?.id).toBe(testChats[2].id);
  });

  it('deletes file', async () => {
    const testChats: Chat[] = [
      {
        id: v4(),
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [
          {
            role: 'user',
            content: [createTextContent('test1')],
            contextType: 'userPrompt',
            context: defaultAIAnalystContext,
          },
        ],
      },
      {
        id: v4(),
        name: 'Chat 2',
        lastUpdated: Date.now(),
        messages: [
          {
            role: 'user',
            content: [createTextContent('test2')],
            contextType: 'userPrompt',
            context: defaultAIAnalystContext,
          },
        ],
      },
      {
        id: v4(),
        name: 'Chat 3',
        lastUpdated: Date.now(),
        messages: [
          {
            role: 'user',
            content: [createTextContent('test3')],
            contextType: 'userPrompt',
            context: defaultAIAnalystContext,
          },
        ],
      },
    ];
    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(3);

    await aiAnalystOfflineChats.deleteFile('test@test.com', 'test-fileId');
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(0);
  });

  it('filters chats by userEmail', async () => {
    // Save chats with current userEmail
    const testChats: Chat[] = [
      {
        id: v4(),
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [
          {
            role: 'user',
            content: [createTextContent('test1')],
            contextType: 'userPrompt',
            context: defaultAIAnalystContext,
          },
        ],
      },
    ];

    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(1);

    await aiAnalystOfflineChats.init('different@test.com', 'test-fileId');
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(0);
  });

  it('filters chats by fileId', async () => {
    // Save chats with current fileId
    const testChats: Chat[] = [
      {
        id: v4(),
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [
          {
            role: 'user',
            content: [createTextContent('test1')],
            contextType: 'userPrompt',
            context: defaultAIAnalystContext,
          },
        ],
      },
    ];
    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(1);

    // Init with different fileId
    await aiAnalystOfflineChats.init('test@test.com', 'different-fileId');
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(0);
  });

  describe('switchFile', () => {
    it('switches to a different file and loads its chats', async () => {
      // First, reinitialize to a known state
      await aiAnalystOfflineChats.init('test@test.com', 'file-A');

      // Save chats for file A
      const fileAChats: Chat[] = [
        {
          id: v4(),
          name: 'File A Chat',
          lastUpdated: Date.now(),
          messages: [
            {
              role: 'user',
              content: [createTextContent('file A message')],
              contextType: 'userPrompt',
              context: defaultAIAnalystContext,
            },
          ],
        },
      ];
      await aiAnalystOfflineChats.saveChats(fileAChats);

      // Switch to file B and save chats
      await aiAnalystOfflineChats.switchFile('test@test.com', 'file-B');
      expect(aiAnalystOfflineChats.fileId).toBe('file-B');

      const fileBChats: Chat[] = [
        {
          id: v4(),
          name: 'File B Chat',
          lastUpdated: Date.now(),
          messages: [
            {
              role: 'user',
              content: [createTextContent('file B message')],
              contextType: 'userPrompt',
              context: defaultAIAnalystContext,
            },
          ],
        },
      ];
      await aiAnalystOfflineChats.saveChats(fileBChats);

      // Verify file B chats
      const loadedFileBChats = await aiAnalystOfflineChats.loadChats();
      expect(loadedFileBChats.length).toBe(1);
      expect(loadedFileBChats[0].name).toBe('File B Chat');

      // Switch back to file A
      const fileAChatsLoaded = await aiAnalystOfflineChats.switchFile('test@test.com', 'file-A');
      expect(aiAnalystOfflineChats.fileId).toBe('file-A');
      expect(fileAChatsLoaded.length).toBe(1);
      expect(fileAChatsLoaded[0].name).toBe('File A Chat');
    });

    it('returns current chats when switching to the same file', async () => {
      await aiAnalystOfflineChats.init('test@test.com', 'same-file');

      const testChats: Chat[] = [
        {
          id: v4(),
          name: 'Same File Chat',
          lastUpdated: Date.now(),
          messages: [
            {
              role: 'user',
              content: [createTextContent('message')],
              contextType: 'userPrompt',
              context: defaultAIAnalystContext,
            },
          ],
        },
      ];
      await aiAnalystOfflineChats.saveChats(testChats);

      // Switch to the same file (should be a no-op but still load chats)
      const chats = await aiAnalystOfflineChats.switchFile('test@test.com', 'same-file');
      expect(chats.length).toBe(1);
      expect(chats[0].name).toBe('Same File Chat');
    });

    it('isolates chats between different files', async () => {
      // This test verifies the core bug fix: chats from one file should NOT appear in another

      await aiAnalystOfflineChats.init('test@test.com', 'original-file');

      // Save a chat in the original file
      const originalFileChat: Chat[] = [
        {
          id: v4(),
          name: 'Original File Chat',
          lastUpdated: Date.now(),
          messages: [
            {
              role: 'user',
              content: [createTextContent('original message')],
              contextType: 'userPrompt',
              context: defaultAIAnalystContext,
            },
          ],
        },
      ];
      await aiAnalystOfflineChats.saveChats(originalFileChat);

      // Switch to a duplicated file (simulating user duplicating a file)
      const duplicatedFileChats = await aiAnalystOfflineChats.switchFile('test@test.com', 'duplicated-file');

      // The duplicated file should NOT have any chats (this was the bug!)
      expect(duplicatedFileChats.length).toBe(0);
      expect(aiAnalystOfflineChats.fileId).toBe('duplicated-file');

      // Save a new chat in the duplicated file
      const newChat: Chat[] = [
        {
          id: v4(),
          name: 'Duplicated File Chat',
          lastUpdated: Date.now(),
          messages: [
            {
              role: 'user',
              content: [createTextContent('duplicated message')],
              contextType: 'userPrompt',
              context: defaultAIAnalystContext,
            },
          ],
        },
      ];
      await aiAnalystOfflineChats.saveChats(newChat);

      // Verify the duplicated file has only its own chat
      const loadedDuplicatedChats = await aiAnalystOfflineChats.loadChats();
      expect(loadedDuplicatedChats.length).toBe(1);
      expect(loadedDuplicatedChats[0].name).toBe('Duplicated File Chat');

      // Switch back to original file and verify its chats are intact
      const originalChatsAgain = await aiAnalystOfflineChats.switchFile('test@test.com', 'original-file');
      expect(originalChatsAgain.length).toBe(1);
      expect(originalChatsAgain[0].name).toBe('Original File Chat');
    });
  });
});
