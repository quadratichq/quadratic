// This file is the entry point for the infra package.

import { redisHost, redisPort } from "./shared/redis";
import "./shared/vpc_peering"; // VPC peering between api-vpc and shared VPC

import { apiPublicDns } from "./api/api";

import { cloudControllerPublicDns } from "./cloud-controller/cloud_controller";

import { connectionPublicDns } from "./connection/connection";

import { filesPublicDns } from "./files/files";

import { multiplayerPublicDns } from "./multiplayer/multiplayer";

// Global exports
export {
  apiPublicDns,
  cloudControllerPublicDns,
  connectionPublicDns,
  filesPublicDns,
  multiplayerPublicDns,
  redisHost,
  redisPort,
};
