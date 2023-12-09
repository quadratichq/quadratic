// This file is the entry point for the infra package.

// Infra stack for the multiplayer service.
import {
  multiplayerInstanceDns,
  multiplayerPublicDns,
} from "./multiplayer/multiplayer";

// Infra stack for the client CDN.
import { clientPublicDns } from "./client/client";

// Global exports
export { clientPublicDns, multiplayerInstanceDns, multiplayerPublicDns };
