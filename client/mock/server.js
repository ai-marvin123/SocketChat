/**
 * Mock Server for SocketChat Frontend Testing
 * 
 * This server provides:
 * - REST API endpoints for chat functionality
 * - WebSocket server for real-time events
 * 
 * Run with: node mock/server.js
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load initial database
const dbPath = join(__dirname, 'db.json');
let db = JSON.parse(readFileSync(dbPath, 'utf-8'));

// Save database helper
function saveDb() {
  writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

const app = express();
const PORT = 3000;

// Store connected WebSocket clients
const clients = new Map(); // userId -> WebSocket
const onlineUsers = new Set();

// Middleware
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================
// REST API Endpoints
// ============================================

// GET /chat/groups - Get groups for a user
app.get('/chat/groups', (req, res) => {
  const userId = req.query.user_id;
  
  const groups = db.conversations.filter(conv => 
    conv.conversation_type === 'GROUP' && 
    conv.participants.includes(userId)
  );
  
  res.json({ groups });
});

// GET /chat/history - Get message history for a conversation
app.get('/chat/history', (req, res) => {
  const { conversation_id, limit = '20', cursor } = req.query;
  
  let allMessages = db.messages
    .filter(m => m.conversation_id === conversation_id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); // Newest first
  
  // Apply cursor pagination
  if (cursor) {
    const cursorIndex = allMessages.findIndex(m => m._id === cursor);
    if (cursorIndex !== -1) {
      allMessages = allMessages.slice(cursorIndex + 1);
    }
  }
  
  const pageMessages = allMessages.slice(0, parseInt(limit));
  const nextCursor = allMessages.length > parseInt(limit) 
    ? pageMessages[pageMessages.length - 1]?._id 
    : null;
  
  res.json({
    history: pageMessages,
    next_cursor: nextCursor
  });
});

// POST /chat/message - Send a new message
app.post('/chat/message', (req, res) => {
  const userId = req.headers['x-user-id'];
  const { conversation_id, content } = req.body;
  
  const newMessage = {
    _id: `msg_${randomUUID()}`,
    conversation_id,
    sender_id: userId,
    content,
    created_at: new Date().toISOString()
  };
  
  // Add to database
  db.messages.push(newMessage);
  saveDb();
  
  // Broadcast to all connected WebSocket clients
  broadcastMessage(newMessage);
  
  res.json({
    message_id: newMessage._id,
    timestamp: newMessage.created_at
  });
});

// POST /chat/group - Create a new group
app.post('/chat/group', (req, res) => {
  const { group_name, user_list } = req.body;
  
  const newGroup = {
    _id: `conv_${randomUUID()}`,
    conversation_type: 'GROUP',
    participants: user_list,
    conversation_name: group_name
  };
  
  db.conversations.push(newGroup);
  saveDb();
  
  res.json({
    conversation_id: newGroup._id
  });
});

// ============================================
// Create HTTP Server
// ============================================

const httpServer = createServer(app);

// ============================================
// WebSocket Server Setup
// ============================================

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  // Extract userId from query string if provided
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let userId = url.searchParams.get('userId');
  
  if (userId) {
    clients.set(userId, ws);
    onlineUsers.add(userId);
    console.log(`[WS] User ${userId} connected`);
    // Send initial presence update
    setTimeout(() => broadcastPresence(), 100);
  } else {
    console.log('[WS] New client connected (awaiting REGISTER)');
  }
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'REGISTER':
          // Register client with their userId
          userId = message.userId;
          clients.set(userId, ws);
          onlineUsers.add(userId);
          console.log(`[WS] User ${userId} registered`);
          broadcastPresence();
          break;
          
        case 'HEARTBEAT':
          // Keep user online - log occasionally
          if (userId) {
            onlineUsers.add(userId);
          }
          break;
          
        default:
          console.log('[WS] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WS] Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      onlineUsers.delete(userId);
      console.log(`[WS] User ${userId} disconnected`);
      broadcastPresence();
    }
  });
  
  ws.on('error', (error) => {
    console.error('[WS] WebSocket error:', error);
  });
});

// Broadcast NEW_MESSAGE event to all clients
function broadcastMessage(message) {
  const event = {
    type: 'NEW_MESSAGE',
    payload: {
      conversation_id: message.conversation_id,
      message_id: message._id,
      sender_id: message.sender_id,
      content: message.content,
      created_at: message.created_at
    }
  };
  
  const eventStr = JSON.stringify(event);
  
  clients.forEach((clientWs, clientUserId) => {
    if (clientWs.readyState === 1) { // WebSocket.OPEN
      clientWs.send(eventStr);
    }
  });
}

// Broadcast PRESENCE_UPDATE event to all clients
function broadcastPresence() {
  const event = {
    type: 'PRESENCE_UPDATE',
    payload: {
      onlineUsers: Array.from(onlineUsers)
    }
  };
  
  const eventStr = JSON.stringify(event);
  
  clients.forEach((clientWs) => {
    if (clientWs.readyState === 1) {
      clientWs.send(eventStr);
    }
  });
  
  console.log(`[WS] Online users: ${Array.from(onlineUsers).join(', ') || 'none'}`);
}

// Periodic presence broadcast
setInterval(() => {
  if (onlineUsers.size > 0) {
    broadcastPresence();
  }
}, 10000);

// ============================================
// Start Server
// ============================================

httpServer.listen(PORT, () => {
  console.log(`
🚀 Mock Server running at http://localhost:${PORT}
   REST API: http://localhost:${PORT}/chat/*
   WebSocket: ws://localhost:${PORT}

📝 Available endpoints:
   GET  /chat/groups?user_id=u1
   GET  /chat/history?conversation_id=conv_group_1
   POST /chat/message
   POST /chat/group

📦 Mock Data:
   Users: ${db.users.map(u => u.name).join(', ')}
   Groups: ${db.conversations.filter(c => c.conversation_type === 'GROUP').map(c => c.conversation_name).join(', ')}
   Messages: ${db.messages.length} total

✨ Ready for frontend testing!
`);
});
