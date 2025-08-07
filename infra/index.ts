// This file is the entry point for the infra package.

import { redisHost, redisPort } from "./shared/redis";

import { apiPublicDns } from "./api/api";

import { connectionPublicDns } from "./connection/connection";

import { filesPublicDns } from "./files/files";

import { multiplayerPublicDns } from "./multiplayer/multiplayer";

// Global exports
export {
  apiPublicDns,
  connectionPublicDns,
  filesPublicDns,
  multiplayerPublicDns,
  redisHost,
  redisPort,
};
