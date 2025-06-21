// This file is the entry point for the infra package.

import { redisHost, redisPort } from "./shared/redis";

import { multiplayerPublicDns } from "./multiplayer/multiplayer";

import { filesPublicDns } from "./files/files";

import { connectionPublicDns } from "./connection/connection";

// Global exports
export {
  connectionPublicDns,
  filesPublicDns,
  multiplayerPublicDns,
  redisHost,
  redisPort,
};
