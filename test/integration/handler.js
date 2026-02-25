"use strict";

const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

module.exports.snsHandler = async (event) => {
  await redis.rpush("sns-results", JSON.stringify(event));
  return {};
};

module.exports.snsHandler2 = async (event) => {
  await redis.rpush("sns-results", JSON.stringify(event));
  return {};
};

module.exports.sqsPassthroughHandler = async (_event) => {
  return {};
};
