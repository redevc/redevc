import { MongoClient } from "mongodb";

import { env } from "../config/env.js";

import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

export const client = new MongoClient(env.MONGODB_URI);
export const db = client.db(env.MONGODB_DB_NAME);
