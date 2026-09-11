import { User } from '../../user/entities/user.entity';

export const PERMISSION_LABELS = {
  PRIVATE_MESSAGE: 'Ãƒâ€“zel Mesaj Atma',
  GENERAL_BROADCAST: 'Genel Atma',
  MEETING_ROOM: 'ToplantÃ„Â± Yetkisi',
  BLOCK_USER: 'Engel Yetkisi',
  ROLE_MANAGEMENT: 'RÃƒÂ¼tbe YÃƒÂ¶netimi',
  STAFF_MANAGEMENT: 'Yetkili YÃƒÂ¶netimi',
  ROOM_MANAGEMENT: 'Oda YÃƒÂ¶netimi',
  ROOM_DELETE: 'Oda Silme',
  ROOM_MESSAGES_DELETE: 'Oda YazÃ„Â±larÃ„Â±nÃ„Â± Sil',
  MICROPHONE_MODERATION: 'Mikrofon Engelle Yetkisi',
  CAMERA_MODERATION: 'Kamera Engelle Yetkisi',
  TEMP_OPERATOR_GRANT: 'GeÃƒÂ§ici OperatÃƒÂ¶rlÃƒÂ¼k Verme',
  ROOF_ACCESS: 'Ãƒâ€¡atÃ„Â± GiriÃ…Å¸i',
  STORY_DELETE: 'Hikaye Silme',
  FLASH_NICK_UPLOAD: 'Flash Nick YÃƒÂ¼kleme',
  ROOM_ENCRYPTION: 'Oda Ã…Âifreleme',
  RADIO_MANAGEMENT: 'Radyo YÃƒÂ¶netimi',
  WORD_BAN: 'Kelime Yasaklama',
  NICKNAME_BAN: 'Rumuz Yasaklama',
  LOGIN_HISTORY: 'GiriÃ…Å¸ KayÃ„Â±tlarÃ„Â±',
  IP_VIEW: 'Ã„Â°p GÃƒÂ¶rme Yetkisi',
  SITE_SETTINGS: 'Site AyarlarÃ„Â±',
  JOIN_EFFECT_SELECT: 'GiriÃ…Å¸ efekti seÃƒÂ§ebilir',
  BAN_MANAGEMENT: 'Banlama',
  SITE_KICK: 'Siteden Atma Yetkisi',
  ADMIN_PANEL: 'Admin Paneli',
  BOT_MANAGEMENT: 'Bot YÃƒÂ¶netimi',
  ADMIN_ACTIONS: 'Admin Hareketleri',
  MEMBER_MANAGEMENT: 'ÃƒÅ“ye YÃƒÂ¶netimi',
  MEMBER_STAFF_DELETE: 'ÃƒÅ“ye ve Yetkili Silme',
  SECRET_NICKNAME_LOGIN: 'Gizli Rumuz GiriÃ…Å¸',
  PERMISSION_GRANT: 'Yetki Verebilir',
  MICROPHONE_INVITE: 'Mikrofon Daveti',
  PRIVATE_CALL: 'Ãƒâ€“zel Arama',
  ROOM_TELEPORT: 'Odaya IÃ…Å¸Ã„Â±nlama',
} as const;

const normalizePermissionLabel = (value?: string | null): string =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');

export const hasEffectivePermission = (params: {
  permissionLabel: string;
  userPermissions?: string[] | null;
  rolePermissions?: Record<string, boolean | unknown> | null;
}): boolean => {
  const normalizedTarget = normalizePermissionLabel(params.permissionLabel);
  if (!normalizedTarget) return false;

  const hasUserPermission = (params.userPermissions ?? []).some(
    (permission) => normalizePermissionLabel(permission) === normalizedTarget,
  );
  if (hasUserPermission) return true;

  for (const [key, value] of Object.entries(params.rolePermissions ?? {})) {
    if (value !== true) continue;
    if (normalizePermissionLabel(key) === normalizedTarget) {
      return true;
    }
  }

  return false;
};

export const hasPermissionForUser = (
  user: Pick<User, 'permissions' | 'role'> | null | undefined,
  permissionLabel: string,
): boolean => {
  if (!user) return false;
  if ((user.role?.starCount ?? 0) === 27) return true;
  return hasEffectivePermission({
    permissionLabel,
    userPermissions: user.permissions,
    rolePermissions: user.role?.permissions,
  });
};

export const isMeetingRoomName = (value?: string | null): boolean => {
  return normalizePermissionLabel(value) ===
    normalizePermissionLabel('ToplantÃ„Â± OdasÃ„Â±');
};
