import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import 'fake-indexeddb/auto';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import { v4 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { aiAnalystOfflineChats } from './aiAnalystChats';

describe('aiAnalystOfflineChats', () => {
  beforeAll(async () => {
    await aiAnalystOfflineChats.init('test@example.com', 'test-fileId');
  });

  beforeEach(async () => {
    await aiAnalystOfflineChats.testClear();
  });

  it('properly defines user email and fileId', () => {
    expect(aiAnalystOfflineChats).toBeDefined();
    expect(aiAnalystOfflineChats.userEmail).toBe('test@example.com');
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
          { role: 'user', content: 'test1', contextType: 'quadraticDocs' },
          {
            role: 'assistant',
            content: 'response1',
            contextType: 'quadraticDocs',
          },
        ],
      },
      {
        id: v4(),
        name: 'Chat 2',
        lastUpdated: Date.now(),
        messages: [
          { role: 'user', content: 'test2', contextType: 'userPrompt', context: defaultAIAnalystContext },
          {
            role: 'assistant',
            content: 'response2',
            contextType: 'userPrompt',
            toolCalls: [],
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
    expect(testChat2?.messages[0].content).toBe('test2');
    expect(testChat2?.messages[1].content).toBe('response2');
  });

  it('deletes chats', async () => {
    const testChats: Chat[] = [
      {
        id: v4(),
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test1', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
      {
        id: v4(),
        name: 'Chat 2',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test2', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
      {
        id: v4(),
        name: 'Chat 3',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test3', contextType: 'userPrompt', context: defaultAIAnalystContext }],
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
        messages: [{ role: 'user', content: 'test1', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
      {
        id: v4(),
        name: 'Chat 2',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test2', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
      {
        id: v4(),
        name: 'Chat 3',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test3', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
    ];
    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(3);

    await aiAnalystOfflineChats.deleteFile('test@example.com', 'test-fileId');
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(0);
  });

  it('filters chats by userEmail', async () => {
    // Save chats with current userEmail
    const testChats: Chat[] = [
      {
        id: v4(),
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test1', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
    ];

    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(1);

    await aiAnalystOfflineChats.init('different@example.com', 'test-fileId');
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(0);
  });

  it('filters chats by fileId', async () => {
    // Save chats with current fileId
    const testChats: Chat[] = [
      {
        id: v4(),
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test1', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
    ];
    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(1);

    // Init with different fileId
    await aiAnalystOfflineChats.init('test@example.com', 'different-fileId');
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(0);
  });
});
