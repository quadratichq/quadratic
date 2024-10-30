import { aiAnalystChatsAtom, aiAnalystCurrentChatAtom } from '@/app/atoms/aiAnalystAtom';
import { DeleteIcon, EditIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { Chat } from 'quadratic-shared/typesAndSchemasAI';
import { useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';

const DEFAULT_CHAT_NAME = 'Untitled chat';

export const AIAnalystChatHistory = () => {
  const [chats, setChats] = useRecoilState(aiAnalystChatsAtom);
  const [currentChat, setCurrentChat] = useRecoilState(aiAnalystCurrentChatAtom);
  const [searchValue, setSearchValue] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatName, setEditingChatName] = useState('');
  const groupedChats = useMemo(() => groupChatsByTime(chats, searchValue), [chats, searchValue]);

  return (
    <div className="mx-2 flex flex-col gap-2">
      <Input autoFocus onChange={(e) => setSearchValue(e.target.value)} value={searchValue} placeholder="Search…" />

      <div className="flex flex-col gap-1 text-muted-foreground">
        {Object.entries(groupedChats).map(
          ([group, groupChats]) =>
            groupChats.length > 0 && (
              <div key={group} className="flex flex-col gap-1">
                <span className="pl-3 text-xs font-semibold">{group}</span>

                {groupChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      'flex items-center justify-between pl-3',
                      chat.id === currentChat.id ? 'bg-muted' : 'hover:cursor-pointer'
                    )}
                    onClick={() => {
                      if (chat.id === currentChat.id) return;
                      setCurrentChat(chat);
                    }}
                  >
                    {editingChatId === chat.id ? (
                      <input
                        className="flex-grow bg-transparent text-sm text-foreground outline-0"
                        value={editingChatName}
                        onChange={(e) => setEditingChatName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.code === 'Enter') {
                            e.currentTarget.blur();
                          } else if (e.code === 'Escape') {
                            setEditingChatId(null);
                          }
                        }}
                        onBlur={() => {
                          setEditingChatId(null);
                          if (editingChatName !== chat.name) {
                            setChats((prev) =>
                              prev.map((prevChat) =>
                                prevChat.id === chat.id ? { ...prevChat, name: editingChatName } : prevChat
                              )
                            );
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div className="flex-shrink truncate text-sm text-foreground">
                        {chat.name ? chat.name : DEFAULT_CHAT_NAME}
                      </div>
                    )}

                    <div className="flex flex-shrink-0 items-center gap-1">
                      <TooltipPopover label="Edit name" side="bottom">
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
                          <EditIcon />
                        </Button>
                      </TooltipPopover>

                      <TooltipPopover label="Delete chat" side="bottom">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setChats((prev) => prev.filter((prevChat) => prevChat.id !== chat.id));
                          }}
                        >
                          <DeleteIcon />
                        </Button>
                      </TooltipPopover>
                    </div>
                  </div>
                ))}
              </div>
            )
        )}
      </div>
    </div>
  );
};

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
