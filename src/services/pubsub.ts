import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const publisher = createClient({ url: redisUrl });
const subscriber = createClient({ url: redisUrl });

publisher.on("error", (error) => {
  console.error("Redis publisher error:", error);
});

subscriber.on("error", (error) => {
  console.error("Redis subscriber error:", error);
});

const connectPubSub = async () => {
  if (!publisher.isOpen) {
    await publisher.connect();
  }
  if (!subscriber.isOpen) {
    await subscriber.connect();
  }
  console.log("Redis Pub/Sub Connected");
};

const publish = async (channel: string, payload: unknown) => {
  const message = JSON.stringify(payload);
  await publisher.publish(channel, message);
};

const subscribe = async (
  channel: string,
  handler: (payload: unknown) => void
) => {
  await subscriber.subscribe(channel, (message) => {
    try {
      handler(JSON.parse(message));
    } catch (error) {
      console.error("Failed to parse pub/sub message:", error);
    }
  });
};

export { connectPubSub, publish, subscribe };
