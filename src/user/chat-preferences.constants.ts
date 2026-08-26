export type ChatPreferences = {
  rejectDirectMessages: boolean;
  rejectIncomingCalls: boolean;
  blockDmWhenTargetOffline: boolean;
  rejectRoomInvites: boolean;
  blockProfileComments: boolean;
  rejectFriendRequests: boolean;
  muteVibrationSounds: boolean;
  hideDirectMessageAlerts: boolean;
  showJoinLeaveEvents: boolean;
  disableJoinEffects: boolean;
  hideGeneralMessages: boolean;
  showTypingIndicators: boolean;
  muteCallRingtone: boolean;
  keepRoomChatHistory: boolean;
  keepDirectChatHistory: boolean;
  ignoredUsernames: string[];
};

export const defaultChatPreferences: ChatPreferences = {
  rejectDirectMessages: false,
  rejectIncomingCalls: false,
  blockDmWhenTargetOffline: false,
  rejectRoomInvites: false,
  blockProfileComments: false,
  rejectFriendRequests: false,
  muteVibrationSounds: false,
  hideDirectMessageAlerts: false,
  showJoinLeaveEvents: false,
  disableJoinEffects: false,
  hideGeneralMessages: false,
  showTypingIndicators: true,
  muteCallRingtone: false,
  keepRoomChatHistory: true,
  keepDirectChatHistory: true,
  ignoredUsernames: [],
};
