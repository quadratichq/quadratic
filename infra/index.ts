// This file is the entry point for the infra package.

// Infra stack for the multiplayer service.
import {
  multiplayerInstanceDns,
  multiplayerPublicDns,
} from "./multiplayer/multiplayer";

import { filesPublicDns } from "./files/files";

// import * as shared from "./shared";

// Global exports
export { filesPublicDns, multiplayerInstanceDns, multiplayerPublicDns };
