export interface User {
  id: string;
  name: string;
  avatar_color?: string;
}

export interface Message {
  _id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  createdAt?: string;  // MongoDB uses createdAt, WS events use created_at
}

export interface Conversation {
  _id: string;
  conversation_type: "GROUP" | "DIRECT"; // Match backend schema
  participants: string[];
  conversation_name?: string;
}

// WebSocket Event Types
export type WebSocketEventType = "NEW_MESSAGE" | "PRESENCE_UPDATE" | "HEARTBEAT" | "READ_RECEIPT";

export interface WSEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
}

export interface NewMessagePayload {
  conversation_id: string;
  message_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface PresenceUpdatePayload {
  onlineUsers: string[];
}

// REST API Types
export interface SendMessageRequest {
  conversation_id: string;
  content: string;
}

export interface SendMessageResponse {
  message_id: string;
  timestamp: string;
}

export interface CreateGroupRequest {
  group_name: string;
  user_list: string[];
}

export interface CreateGroupResponse {
  conversation_id: string;
}
