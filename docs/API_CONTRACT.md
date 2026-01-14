# SocketChat API Contract

This document defines the interface between the Frontend and Backend for SocketChat.
**Version:** 1.0.0
**Source:** `docs/SPECS.md`

---

## 1. REST API

**Base URL:** `http://localhost:3000` (Development)

### A. Messaging

#### 1. Send Message
Persists a message to the database and triggers a WebSocket broadcast to participants.

- **Endpoint:** `POST /chat/message`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```typescript
  interface SendMessageRequest {
    conversation_id: string; // ObjectId of the conversation
    content: string;         // Plain text message content
  }
  ```
- **Success Response (200 OK):**
  ```typescript
  interface SendMessageResponse {
    message_id: string;      // Unique ID of the created message
    timestamp: string;       // ISO 8601 or similar timestamp
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing fields or invalid conversation ID.
  - `404 Not Found`: Conversation does not exist.
  - `500 Internal Server Error`: Server failure.

#### 2. Get Message History
Fetches paginated message history for a conversation.

- **Endpoint:** `GET /chat/history`
- **Query Parameters:**
  - `conversation_id` (Required): ID of the conversation.
  - `limit` (Optional): Number of messages to return (Default: 20).
  - `cursor` (Optional): `message_id` of the last message seen (for pagination).
- **Success Response (200 OK):**
  ```typescript
  interface GetHistoryResponse {
    history: Array<{
      _id: string;
      sender_id: string;
      content: string;
      created_at: string;
    }>;
    next_cursor: string | null; // Null if no more messages
  }
  ```

### B. Groups

#### 1. Create Group
Creates a new group conversation.

- **Endpoint:** `POST /chat/group`
- **Request Body:**
  ```typescript
  interface CreateGroupRequest {
    group_name: string;
    user_list: string[]; // Array of User IDs to include
  }
  ```
- **Success Response (201 Created):**
  ```typescript
  interface CreateGroupResponse {
    conversation_id: string;
  }
  ```

---

## 2. WebSocket API

**URL:** `ws://localhost:PORT` or `ws://localhost:3000`

### Connection & Authentication
- **Query Param:** `?userId=USER_ID`
- **Behavior:** The connection is immediately associated with the provided `userId`.
- **Handling:** If `userId` is missing, the server accepts the socket but closes it immediately with a standard error code (e.g., 4000).

### Events

All WebSocket messages must follow this structure:
```json
{
  "type": "EVENT_NAME",
  "payload": { ... }
}
```

### A. Server -> Client (Downstream)

#### 1. `NEW_MESSAGE`
Broadcasted to all active participants when a message is successfully sent via `POST /chat/message`.

- **Payload:**
  ```typescript
  interface NewMessagePayload {
    conversation_id: string;
    message_id: string;
    sender_id: string;
    content: string;
    created_at: string;
  }
  ```

#### 2. `PRESENCE_UPDATE`
Sent when a user's online status changes (detected via Heartbeat/Redis).

- **Payload:**
  ```typescript
  interface PresenceUpdatePayload {
    user_id: string;
    status: "ONLINE" | "OFFLINE";
  }
  ```

### B. Client -> Server (Upstream)

#### 1. `HEARTBEAT`
Sent by the client every **5 seconds** to maintain "ONLINE" status.

- **Payload:** `null` or `{}`
- **Example:**
  ```json
  { "type": "HEARTBEAT" }
  ```

#### 2. `READ_RECEIPT` (Optional)
Sent when a user actively opens or views a conversation.

- **Payload:**
  ```typescript
  interface ReadReceiptPayload {
    conversation_id: string;
    message_id: string; // The ID of the message being read (usually the latest)
  }
  ```

---

## 3. Data Models (Reference)

### User
*Managed by hardcoded list in Phase 1*
```typescript
interface User {
  id: string;
  name: string;
  avatar_color?: string;
}
```

### Conversation
```typescript
interface Conversation {
  _id: string; // ObjectId
  type: "GROUP" | "DIRECT";
  participants: string[]; // User IDs
  name?: string; // Only for GROUP
}
```

### Message
```typescript
interface Message {
  _id: string; // ObjectId
  conversation_id: string; // ObjectId
  sender_id: string;
  content: string;
  created_at: Date;
}
```
