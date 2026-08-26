type ProtectionAccessInput = {
  actorStarCount: number;
  isRoot?: boolean;
  targetProtection?: boolean | null;
  targetProtectedByStarCount?: number | null;
};

export const isProtectedActionBlocked = ({
  actorStarCount,
  isRoot = false,
  targetProtection = false,
  targetProtectedByStarCount = 0,
}: ProtectionAccessInput): boolean => {
  if (isRoot || !targetProtection) {
    return false;
  }

  return actorStarCount < (targetProtectedByStarCount ?? 0);
};
