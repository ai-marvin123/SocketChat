import mongoose, { Schema } from "mongoose";

export interface Conversation {
  _id: string; // ObjectId
  type: "GROUP" | "DIRECT";
  participants: string[]; // User IDs
  name?: string; // Only for GROUP
}

export type ConversationDoc = mongoose.Document & Omit<Conversation, "_id">;

const ConversationSchema = new Schema<ConversationDoc>(
  {
    type: { type: String, enum: ["GROUP", "DIRECT"], required: true },
    participants: { type: [String], required: true },
    name: { type: String },
  },
  { timestamps: true }
);

export const ConversationModel = mongoose.model<ConversationDoc>(
  "Conversation",
  ConversationSchema
);
