import express from "express";
import * as dotenv from "dotenv";
import connectDB from "./config/db";
import cors from "cors";
import { ConversationModel } from "./models/conversation.schema";
import type {
  CreateGroupRequest,
  GetHistoryResponse,
  NewMessagePayload,
} from "./types/chat";
import { MessageModel } from "./models/message.schema";
import mongoose from "mongoose";
dotenv.config();

const app = express();
const port = 3000;

const startDB = async () => {
  await connectDB();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("SITE IS LIVE!!");
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
    const { conversation_id, sender_id, content } = body;

    if (!conversation_id || !sender_id || !content) {
      return res
        .status(400)
        .json({
          error: "conversation_id, sender_id, and content are required.",
        });
    }

    const conversation = await ConversationModel.findById(conversation_id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const message = await MessageModel.create({
      conversation_id,
      sender_id,
      content,
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
