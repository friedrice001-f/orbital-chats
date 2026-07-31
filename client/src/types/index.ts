export interface PublicUser {
  id: string;
  displayName: string;
  phone: string;
  online: boolean;
}

export type RoomType = "dm" | "group";

export interface RoomSummary {
  id: string;
  type: RoomType;
  name: string;
  memberIds: string[];
}

export interface ImagePayload {
  dataUrl: string;
  name: string;
  mime: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  text: string | null;
  image: ImagePayload | null;
  createdAt: number;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: PublicUser;
  rooms?: RoomSummary[];
  onlineUsers?: PublicUser[];
}

export interface OpenDmResult {
  ok: boolean;
  error?: string;
  room?: RoomSummary;
  history?: ChatMessage[];
}

export interface CreateGroupResult {
  ok: boolean;
  error?: string;
  room?: RoomSummary;
  history?: ChatMessage[];
}

export interface SendMessageResult {
  ok: boolean;
  error?: string;
  message?: ChatMessage;
}

export interface TypingEvent {
  roomId: string;
  userId: string;
  isTyping: boolean;
}

export type CallStatus = "idle" | "calling" | "ringing" | "connected";

export interface IncomingCallInfo {
  fromUserId: string;
  fromName: string;
}
