# SocketChat Action Plan

This document outlines the step-by-step plan to implement SocketChat based on `docs/SPECS.md` and `mocks/API_CONTRACT.md`.

## Phase 1: Backend Scaffolding & REST API

**Goal:** Establish the Express server, MongoDB connection, and implement the REST endpoints based on the contract.

### Checklist

- [ ] **Project Setup**
  - [x] `npm init` and install dependencies: `express`, `mongoose`, `dotenv`, `cors`, `helmet`.
  - [x] Setup TypeScript configuration (`tsconfig.json`).
  - [x] Create folder structure: `src/{controllers, models, routes, services, config}`.
- [ ] **Database (MongoDB)**
  - [x] Setup `mongoose` connection logic.
  - [x] Create `User` schema (for hardcoded simulation).
  - [x] Create `Conversation` schema.
  - [x] Create `Message` schema.
- [x] **REST Implementation**
  - [x] Implement `POST /chat/group` (Create Group).
  - [x] Implement `POST /chat/message` (Send Message logic - DB part only).
  - [x] Implement `GET /chat/history` (Pagination logic).
  - [x] **Verification**: Test endpoints with Postman/curl.

## Phase 2: Real-time Layer (Redis + WebSocket)

**Goal:** Implement the WebSocket server for real-time messaging and presence using Redis for state/pub-sub.

### Checklist

- [ ] **Redis Setup**
  - [x] Install `redis` (client).
  - [x] Create Redis Client singleton.
  - [x] Implement Pub/Sub helper classes.
- [ ] **WebSocket Server**
  - [ ] Install `ws` library.
  - [ ] Initialize `WebSocketServer` attached to HTTP server.
  - [ ] Implement `Client` class to wrap `ws` connection with `userId`.
- [ ] **Messaging Logic**
  - [ ] Connect `POST /chat/message` to WebSocket Broadcaster.
  - [ ] Implement `NEW_MESSAGE` event broadcast.
- [ ] **Presence/Heartbeat System**
  - [ ] Implement `HEARTBEAT` handler.
  - [ ] Redis keys: `SET user:{id}:online "1" EX 10`.
  - [ ] Implement Presence Monitoring (Interval or Keyspace Notifications) to trigger `PRESENCE_UPDATE`.

## Phase 3: Frontend Implementation

**Goal:** Build the React application, integrating the API and WebSocket.

### Checklist

- [ ] **Setup**
  - [ ] Create Vite project (`react-ts`).
  - [ ] Setup Tailwind CSS.
- [ ] **State Management**
  - [ ] Create `AuthContext` (Hardcoded login).
  - [ ] Create `SocketContext` (Manage WS connection).
  - [ ] Create `ChatContext` (Store messages/conversations).
- [ ] **UI Components**
  - [ ] `Sidebar`: List Users/Groups + Presence Indicators.
  - [ ] `ChatWindow`: Message List + Input.
  - [ ] `LoginModal`: Selector for test users.
- [ ] **Integration**
  - [ ] Fetch history on conversation select.
  - [ ] Handle `NEW_MESSAGE` WS event (append to list).
  - [ ] Handle `PRESENCE_UPDATE` WS event (update sidebar).
  - [ ] Send Heartbeats every 5s.

## Phase 4: Polish & Deployment

**Goal:** Final testing and cleanup.

### Checklist

- [ ] **Error Handling**: Graceful reconnection logic for WS.
- [ ] **Edge Cases**: Empty messages, huge history loading.
- [ ] **Documentation**: Update `README.md`.
