// This file is the entry point for the infra package.

import { redisHost, redisPort } from "./shared/redis";

import { multiplayerPublicDns } from "./multiplayer/multiplayer";

import { filesPublicDns } from "./files/files";

import { apiPublicDns } from "./api/api";


// Global exports
export {
    //clientPublicDns,
    apiPublicDns,
    filesPublicDns,
    multiplayerPublicDns,
    redisHost,
    redisPort
};
