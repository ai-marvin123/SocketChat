import mongoose, { Schema } from "mongoose";

export interface Message {
  _id: string; // ObjectId
  conversation_id: string; // ObjectId
  sender_id: string;
  content: string;
  created_at: Date;
}

export type MessageDoc = mongoose.Document & Omit<Message, "_id">;

const MessageSchema = new Schema<MessageDoc>(
  {
    conversation_id: { type: String, required: true },
    sender_id: { type: String, required: true },
    content: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const MessageModel = mongoose.model<MessageDoc>("Message", MessageSchema);
