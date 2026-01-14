// Load .env FIRST before any imports that depend on environment variables
import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import connectDB from "./config/db";
import cors from "cors";
import { ConversationModel } from "./models/conversation.schema";
import type {
  CreateGroupRequest,
  GetHistoryResponse,
  NewMessagePayload,
  PresenceUpdatePayload,
} from "./types/chat";
import { MessageModel } from "./models/message.schema";
import mongoose from "mongoose";
import { connectRedis } from "./config/redis";
import { redisClient } from "./config/redis";
import http from "http";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { Client } from "./services/client";

const app = express();
const port = 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map<string, Client>();
const presence = new Map<string, "ONLINE" | "OFFLINE">();

const broadcastPresence = () => {
  const onlineUsers = Array.from(presence.entries())
    .filter(([, status]) => status === "ONLINE")
    .map(([userId]) => userId);

  const payload: PresenceUpdatePayload = { onlineUsers };
  clients.forEach((client) => {
    client.send({ type: "PRESENCE_UPDATE", payload });
  });
};

const startServer = async () => {
  await connectDB();
  await connectRedis();
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

wss.on("connection", (socket: WebSocket, request: http.IncomingMessage) => {
  const requestUrl = request.url ?? "/";
  const { searchParams } = new URL(requestUrl, `http://localhost:${port}`);
  const userId = searchParams.get("userId");

  if (!userId) {
    socket.close(4000, "Missing userId");
    return;
  }

  const client = new Client(socket, userId);
  clients.set(userId, client);
  console.log(`WebSocket connected: ${client.userId}`);

  socket.on("message", async (data) => {
    let parsed: { type?: string } | null = null;
    try {
      parsed = JSON.parse(data.toString());
    } catch (error) {
      console.error("Invalid WS message:", error);
      return;
    }

    if (parsed?.type === "HEARTBEAT") {
      await redisClient.set(`user:${userId}:online`, "1", { EX: 10 });
      presence.set(userId, "ONLINE");
      broadcastPresence();
    }
  });

  socket.on("close", () => {
    clients.delete(userId);
    console.log(`WebSocket disconnected: ${userId}`);
  });
});

// START DATABASE/REDIS AND HTTP SERVER
startServer();

setInterval(async () => {
  for (const userId of clients.keys()) {
    const isOnline = await redisClient.exists(`user:${userId}:online`);
    if (!isOnline && presence.get(userId) !== "OFFLINE") {
      presence.set(userId, "OFFLINE");
      broadcastPresence();
    }
  }
}, 5000);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("SITE IS LIVE!!");
});

//Fetch groups
app.get("/chat/groups", async (req, res) => {
  try {
    const { user_id } = req.query;
    const filter =
      typeof user_id === "string" && user_id
        ? { type: "GROUP", participants: user_id }
        : { type: "GROUP" };

    const groups = await ConversationModel.find(filter);

    return res.status(200).json({
      groups: groups.map((group) => ({
        _id: group._id.toString(),
        conversation_type: group.type,
        participants: group.participants,
        conversation_name: group.name,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch groups." });
  }
});

//Create group
app.post("/chat/group", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Partial<CreateGroupRequest>;
    const { group_name, user_list } = body;

    console.log("The users in this group are ", user_list);

    if (!group_name || !Array.isArray(user_list) || user_list.length === 0) {
      return res
        .status(400)
        .json({ error: "group_name and user_list are required." });
    }

    const group = await ConversationModel.create({
      type: "GROUP",
      participants: user_list,
      name: group_name,
    });

    return res.status(201).json({ conversation_id: group._id.toString() });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create group." });
  }
});

//Send message logic
app.post("/chat/message", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Partial<NewMessagePayload>;
    const headerSenderId =
      typeof req.headers["x-user-id"] === "string"
        ? req.headers["x-user-id"]
        : undefined;
    const { conversation_id, sender_id: bodySenderId, content } = body;
    const sender_id = bodySenderId ?? headerSenderId;

    if (!conversation_id || !sender_id || !content) {
      return res.status(400).json({
        error: "conversation_id, sender_id, and content are required.",
      });
    }

    let conversation = null;
    if (mongoose.Types.ObjectId.isValid(conversation_id)) {
      conversation = await ConversationModel.findById(conversation_id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found." });
      }
    }

    const message = await MessageModel.create({
      conversation_id,
      sender_id,
      content,
    });

    const payload: NewMessagePayload = {
      conversation_id,
      message_id: message._id.toString(),
      sender_id,
      content,
      created_at: message.created_at.toISOString(),
    };

    let participants: string[] = [];
    if (conversation) {
      participants = conversation.participants;
    } else if (conversation_id.startsWith("dm_")) {
      participants = conversation_id.replace("dm_", "").split("_");
    }

    participants.forEach((participantId) => {
      const client = clients.get(participantId);
      if (client) {
        client.send({ type: "NEW_MESSAGE", payload });
      }
    });

    return res.status(200).json({
      message_id: message._id.toString(),
      timestamp: message.created_at.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to send message." });
  }
});

//Pagination logic
app.get("/chat/history", async (req, res) => {
  try {
    const { conversation_id, limit, cursor } = req.query;

    if (typeof conversation_id !== "string" || !conversation_id) {
      return res.status(400).json({ error: "conversation_id is required." });
    }

    const parsedLimit =
      typeof limit === "string" && Number.isFinite(Number(limit))
        ? Math.min(Number(limit), 100)
        : 20;

    const query: {
      conversation_id: string;
      _id?: { $lt: mongoose.Types.ObjectId };
    } = { conversation_id };

    if (typeof cursor === "string" && cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).json({ error: "Invalid cursor." });
      }
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const messages = await MessageModel.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1);

    const hasMore = messages.length > parsedLimit;
    const sliced = hasMore ? messages.slice(0, parsedLimit) : messages;

    const payload: GetHistoryResponse = {
      history: sliced.map((message) => ({
        _id: message._id.toString(),
        sender_id: message.sender_id,
        content: message.content,
        created_at: message.created_at.toISOString(),
      })),
      next_cursor: hasMore ? sliced[sliced.length - 1]._id.toString() : null,
    };

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch history." });
  }
});
