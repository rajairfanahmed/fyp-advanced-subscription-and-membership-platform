import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToMongoDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing. Add it to .env.local before using MongoDB profile APIs.");
  }

  cached.promise ??= mongoose.connect(uri, {
    bufferCommands: false,
  });

  cached.conn = await cached.promise;
  return cached.conn;
}
