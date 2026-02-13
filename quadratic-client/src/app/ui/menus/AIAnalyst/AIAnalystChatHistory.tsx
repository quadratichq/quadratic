import { chatsWithPersistenceAtom, currentChatAtom, showChatHistoryAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { DeleteIcon, FileRenameIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useAtom, useSetAtom } from 'jotai';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useMemo, useState } from 'react';

const DEFAULT_CHAT_NAME = 'Untitled chat';

export const AIAnalystChatHistory = memo(() => {
  const [chats, setChats] = useAtom(chatsWithPersistenceAtom);
  const [currentChat, setCurrentChat] = useAtom(currentChatAtom);
  const setShowChatHistory = useSetAtom(showChatHistoryAtom);
  const [searchValue, setSearchValue] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatName, setEditingChatName] = useState('');
  const chatGroups = useMemo(() => groupChatsByTime(chats, searchValue), [chats, searchValue]);

  return (
    <div className="flex flex-col gap-2 overflow-y-auto px-2 pt-0.5">
      <Input
        autoFocus
        onChange={(e) => setSearchValue(e.target.value)}
        value={searchValue}
        placeholder="Search…"
        className="sticky top-0.5 z-10 bg-background"
      />

      <div className="flex flex-col gap-1 text-muted-foreground">
        {Object.entries(chatGroups).map(
          ([group, chats]) =>
            chats.length > 0 && (
              <div key={group} className="flex flex-col gap-1">
                <span className="pl-3 text-xs font-semibold">{group}</span>

                {chats.map((chat) => {
                  const isCurrentChat = chat.id === currentChat.id;
                  const isBeingRenamed = editingChatId === chat.id;

                  return (
                    <div
                      key={chat.id}
                      className={cn(
                        'relative flex h-8 items-center justify-between rounded pl-3 hover:bg-muted',
                        isBeingRenamed ? 'bg-muted' : 'hover:cursor-pointer',
                        isCurrentChat &&
                          'cursor-default after:absolute after:left-0 after:top-1/2 after:h-1.5 after:w-1.5 after:-translate-y-1/2 after:rounded-full after:bg-primary after:content-[""]'
                      )}
                      onClick={() => {
                        if (isBeingRenamed) return;
                        if (isCurrentChat) {
                          setShowChatHistory(false);
                          return;
                        }
                        setCurrentChat(chat);
                      }}
                    >
                      {isBeingRenamed ? (
                        <input
                          className="flex-grow bg-transparent text-sm text-foreground outline-0"
                          value={editingChatName}
                          onChange={(e) => setEditingChatName(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              setEditingChatId(null);
                            }
                          }}
                          onBlur={() => {
                            setEditingChatId(null);
                            if (editingChatName !== chat.name) {
                              setChats(
                                chats.map((prevChat) =>
                                  prevChat.id === chat.id ? { ...prevChat, name: editingChatName } : prevChat
                                )
                              );
                            }
                          }}
                          onFocus={(e) => {
                            e.currentTarget.select();
                          }}
                          autoFocus
                        />
                      ) : (
                        <div className="flex-shrink truncate text-sm text-foreground">
                          {chat.name ? chat.name : DEFAULT_CHAT_NAME}
                        </div>
                      )}

                      {!isBeingRenamed && (
                        <div className="flex flex-shrink-0 items-center">
                          <TooltipPopover label="Rename">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingChatId(chat.id);
                                setEditingChatName(chat.name);
                              }}
                            >
                              <FileRenameIcon />
                            </Button>
                          </TooltipPopover>

                          <TooltipPopover label="Delete">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                setChats(chats.filter((prevChat) => prevChat.id !== chat.id));
                              }}
                            >
                              <DeleteIcon />
                            </Button>
                          </TooltipPopover>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
        )}
      </div>
    </div>
  );
});

const groupChatsByTime = (chats: Chat[], searchValue: string) => {
  chats = [...chats]
    .filter((chat) => chat.name.toLowerCase().includes(searchValue.toLowerCase()))
    .sort((a, b) => b.lastUpdated - a.lastUpdated);

  const groups: Record<string, Chat[]> = {};
  const addToGroup = (group: string, chat: Chat) => {
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(chat);
  };

  const oneMinute = 60 * 1000;
  const oneHour = 60 * oneMinute;
  const oneDay = 24 * oneHour;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;
  const oneYear = 365 * oneDay;

  const now = Date.now();

  chats.forEach((chat) => {
    const chatDate = new Date(chat.lastUpdated);
    const timeDiff = now - chatDate.getTime();

    if (timeDiff < oneMinute) {
      addToGroup('now', chat);
    } else if (timeDiff < oneHour) {
      const minutes = Math.floor(timeDiff / oneMinute);
      addToGroup(`${minutes}m ago`, chat);
    } else if (timeDiff < oneDay) {
      const hours = Math.floor(timeDiff / oneHour);
      addToGroup(`${hours}h ago`, chat);
    } else if (timeDiff < oneWeek) {
      const days = Math.floor(timeDiff / oneDay);
      addToGroup(`${days}d ago`, chat);
    } else if (timeDiff < oneMonth) {
      const weeks = Math.floor(timeDiff / oneWeek);
      addToGroup(`${weeks}w ago`, chat);
    } else if (timeDiff < oneYear) {
      const months = Math.floor(timeDiff / oneMonth);
      addToGroup(`${months}mo ago`, chat);
    } else {
      const years = Math.floor(timeDiff / oneYear);
      addToGroup(`${years}y ago`, chat);
    }
  });

  return groups;
};
