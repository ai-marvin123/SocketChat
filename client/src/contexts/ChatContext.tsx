import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import type { Conversation, Message, WSEvent, NewMessagePayload, PresenceUpdatePayload } from '../types';
import { API_BASE } from '../config';

// Notification event info passed to callback
export interface NotificationEventInfo {
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
}

interface ChatContextType {
  conversations: Conversation[];
  groups: Conversation[];  // GROUP type conversations
  currentConversation: Conversation | null;
  messages: Message[];
  onlineUsers: Map<string, string>; // userId -> status
  hasMoreMessages: boolean;  // Pagination: more messages available
  isLoadingMore: boolean;    // Loading state for pagination
  unreadCounts: Map<string, number>;  // conversationId -> unread count
  totalUnread: number;  // Sum of all unread counts
  setCurrentConversation: (conversation: Conversation | null) => void;
  sendMessage: (content: string) => Promise<void>;
  createGroup: (name: string, members: string[]) => Promise<void>;
  fetchGroups: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;  // Pagination: load older messages
  markAsRead: (conversationId: string) => void;  // Mark conversation as read
  onNewMessageNotification: (callback: (info: NotificationEventInfo) => void) => () => void;  // Subscribe to new message events
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { socket } = useSocket();
  const { currentUser, availableUsers } = useAuth();
  
  const [conversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, string>>(new Map());
  const [nextCursor, setNextCursor] = useState<string | null>(null);  // Pagination cursor
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  
  // Notification callbacks - stored in ref to avoid re-renders
  const [notificationCallbacks, setNotificationCallbacks] = useState<Set<(info: NotificationEventInfo) => void>>(new Set());

  // Calculate total unread count
  const totalUnread = useMemo(() => {
    let total = 0;
    unreadCounts.forEach(count => {
      total += count;
    });
    return total;
  }, [unreadCounts]);

  // Mark a conversation as read
  const markAsRead = useCallback((conversationId: string) => {
    setUnreadCounts(prev => {
      const newMap = new Map(prev);
      newMap.delete(conversationId);
      return newMap;
    });
  }, []);

  // Subscribe to new message notification events
  const onNewMessageNotification = useCallback((callback: (info: NotificationEventInfo) => void) => {
    setNotificationCallbacks(prev => new Set(prev).add(callback));
    
    // Return unsubscribe function
    return () => {
      setNotificationCallbacks(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  // Helper to get sender name
  const getSenderName = useCallback((senderId: string): string => {
    const user = availableUsers.find(u => u.id === senderId);
    return user?.name || senderId;
  }, [availableUsers]);

  // Fetch groups when user logs in
  const fetchGroups = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/chat/groups?user_id=${currentUser.id}`);
      const data = await res.json();
      if (res.ok) {
        setGroups(data.groups);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  // Fetch groups on mount
  useEffect(() => {
    if (currentUser) {
      fetchGroups();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Listen for WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data: WSEvent = JSON.parse(event.data);
        
        switch (data.type) {
          case 'NEW_MESSAGE': {
            const msgPayload = data.payload as NewMessagePayload;
            const isFromSelf = msgPayload.sender_id === currentUser?.id;
            const isCurrentConversation = currentConversation?._id === msgPayload.conversation_id;
            
            // Skip messages from self
            if (isFromSelf) break;
            
            if (isCurrentConversation) {
                // Append to messages if viewing this conversation
                setMessages((prev) => [...prev, {
                    _id: msgPayload.message_id,
                    conversation_id: msgPayload.conversation_id,
                    sender_id: msgPayload.sender_id,
                    content: msgPayload.content,
                    created_at: msgPayload.created_at
                }]);
            } else {
                // Increment unread count for other conversations
                setUnreadCounts(prev => {
                    const newMap = new Map(prev);
                    const currentCount = newMap.get(msgPayload.conversation_id) || 0;
                    newMap.set(msgPayload.conversation_id, currentCount + 1);
                    return newMap;
                });
                
                // Trigger notification callbacks
                const notificationInfo: NotificationEventInfo = {
                    conversationId: msgPayload.conversation_id,
                    senderId: msgPayload.sender_id,
                    senderName: getSenderName(msgPayload.sender_id),
                    content: msgPayload.content
                };
                notificationCallbacks.forEach(callback => callback(notificationInfo));
            }
            break;
          }

          case 'PRESENCE_UPDATE': {
            const presencePayload = data.payload as PresenceUpdatePayload;
            
            if (!presencePayload || !presencePayload.onlineUsers) {
                console.warn('Received invalid PRESENCE_UPDATE payload:', data);
                break;
            }

            setOnlineUsers(() => {
              const newMap = new Map(); // Reset map based on current full list
              presencePayload.onlineUsers.forEach(uid => {
                  newMap.set(uid, 'ONLINE');
              });
              return newMap;
            });
            break;
          }
            
          default:
            break;
        }
      } catch (error) {
        console.error('Error parsing WS message:', error);
      }
    };

    socket.addEventListener('message', handleMessage);

    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, currentConversation, currentUser?.id, getSenderName, notificationCallbacks]);

  // Fetch History when Current Conversation Changes
  useEffect(() => {
    if (!currentConversation) {
        setTimeout(() => setMessages([]), 0);
        setNextCursor(null);
        setHasMoreMessages(false);
        return;
    }

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${API_BASE}/chat/history?conversation_id=${currentConversation._id}&limit=20`);
            const data = await res.json();
            if (res.ok) {
                // Reverse to show oldest first (API returns newest first for pagination)
                // Use spread to avoid mutating original array (important for React StrictMode)
                setMessages([...data.history].reverse());
                setNextCursor(data.next_cursor);
                setHasMoreMessages(!!data.next_cursor);
            }
        } catch (err) {
            console.error('Failed to fetch history', err);
        }
    };

    fetchHistory();
  }, [currentConversation]);

  // Load more (older) messages - pagination
  const loadMoreMessages = async () => {
    if (!currentConversation || !nextCursor || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `${API_BASE}/chat/history?conversation_id=${currentConversation._id}&limit=20&cursor=${nextCursor}`
      );
      const data = await res.json();
      if (res.ok) {
        // Prepend older messages to the beginning (reversed because API returns newest first)
        // Use spread to avoid mutating original array (important for React StrictMode)
        const olderMessages = [...data.history].reverse();
        setMessages((prev) => [...olderMessages, ...prev]);
        setNextCursor(data.next_cursor);
        setHasMoreMessages(!!data.next_cursor);
      }
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!currentConversation || !currentUser) return;
    
    try {
        const res = await fetch(`${API_BASE}/chat/message`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-id': currentUser.id  // Identify sender to backend
            },
            body: JSON.stringify({
                conversation_id: currentConversation._id,
                content
            })
        });
        
        // Optimistically add message to UI on success
        if (res.ok) {
            const data = await res.json();
            setMessages((prev) => [...prev, {
                _id: data.message_id,
                conversation_id: currentConversation._id,
                sender_id: currentUser.id,
                content,
                created_at: data.timestamp
            }]);
        }
    } catch (err) {
        console.error('Failed to send message', err);
    }
  };

  const createGroup = async (name: string, members: string[]) => {
      try {
          const res = await fetch(`${API_BASE}/chat/group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                group_name: name,
                user_list: members
            })
          });
          await res.json();
          // Ideally we re-fetch conversations here or get the full object back
      } catch (err) {
          console.error('Failed to create group', err);
      }
  };

  // Wrapper to also mark as read when setting current conversation
  const handleSetCurrentConversation = useCallback((conversation: Conversation | null) => {
    setCurrentConversation(conversation);
    if (conversation) {
      markAsRead(conversation._id);
    }
  }, [markAsRead]);

  return (
    <ChatContext.Provider value={{ 
        conversations,
        groups,
        currentConversation, 
        messages, 
        onlineUsers,
        hasMoreMessages,
        isLoadingMore,
        unreadCounts,
        totalUnread,
        setCurrentConversation: handleSetCurrentConversation, 
        sendMessage,
        createGroup,
        fetchGroups,
        loadMoreMessages,
        markAsRead,
        onNewMessageNotification
    }}>
      {children}
    </ChatContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
