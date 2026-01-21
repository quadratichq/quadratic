import { atomWithStorage } from 'jotai/utils';

const AGENT_MODE_KEY = 'agentMode';

export const agentModeAtom = atomWithStorage<boolean>(AGENT_MODE_KEY, false);
