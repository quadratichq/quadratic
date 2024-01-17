// This file is the entry point for the infra package.

import { redisHost, redisPort } from "./shared/redis";

import {
  multiplayerInstanceDns,
  multiplayerPublicDns,
} from "./multiplayer/multiplayer";

import { filesPublicDns } from "./files/files";

// Global exports
export {
  filesPublicDns,
  multiplayerInstanceDns,
  multiplayerPublicDns,
  redisHost,
  redisPort,
};
