export interface CreateGroupRequest {
  group_name: string;
  user_list: string[];
}
export interface NewMessagePayload {
  conversation_id: string;
  message_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface GetHistoryResponse {
  history: Array<{
    _id: string;
    sender_id: string;
    content: string;
    created_at: string;
  }>;
  next_cursor: string | null; // Null if no more messages
}

export interface PresenceUpdatePayload {
  onlineUsers: string[];
}
