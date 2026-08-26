export const normalizeAgentNickname = (
  agentNickname?: string | null,
): string | null => {
  const normalized = (agentNickname || '').trim();
  return normalized.length > 0 ? normalized : null;
};

export const buildNormalIdentityKey = (userId: number): string =>
  `u:${userId}:normal`;

export const buildAgentIdentityKey = (
  userId: number,
  agentNickname: string,
): string => `u:${userId}:agent:${agentNickname.toLocaleLowerCase('tr-TR')}`;

export const buildIdentity = (
  userId: number,
  agentNickname?: string | null,
): {
  identityType: 'normal' | 'agent';
  identityKey: string;
  normalizedAgentNickname: string | null;
} => {
  const normalizedAgentNickname = normalizeAgentNickname(agentNickname);
  if (!normalizedAgentNickname) {
    return {
      identityType: 'normal',
      identityKey: buildNormalIdentityKey(userId),
      normalizedAgentNickname: null,
    };
  }

  return {
    identityType: 'agent',
    identityKey: buildAgentIdentityKey(userId, normalizedAgentNickname),
    normalizedAgentNickname,
  };
};
