const experimentId = 'experiment.ai_msg_count_limit.v1';

// Deterministically maps a UUID to a number between 5 and 30
export async function getExperimentAIMsgCountLimit(teamUuid: string) {
  // Normalize input
  const inputId = teamUuid.toLowerCase().replace(/-/g, '');
  const input = `${experimentId}:${inputId}`;

  // Encode as bytes
  const data = new TextEncoder().encode(input);

  // hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  // take first 4 bytes as integer
  const h = (hashArray[0] << 24) | (hashArray[1] << 16) | (hashArray[2] << 8) | hashArray[3];
  const unsigned = h >>> 0; // convert to unsigned 32-bit

  // Convert to fraction
  const u = unsigned / 2 ** 32;

  // Scale to 5...30
  // return 5 + Math.floor(u * 26);
  // scale to [min, max]
  const min = 5;
  const max = 30;
  const range = max - min + 1;
  const value = min + Math.floor(u * range);

  return {
    value,
    events: {
      [`${experimentId}.value`]: value,
    },
  };
}
