/**
 * In-memory data store.
 *
 * Everything here is intentionally accessed through small, named methods
 * (not raw Map access) so that swapping this for a real database
 * (Postgres/Mongo/Redis) later only requires rewriting this one file —
 * nothing in index.js needs to change.
 *
 * Data shapes:
 *   user:    { id, socketId, phone, displayName, online }
 *   room:    { id, type: 'dm' | 'group', name?, memberIds: string[], createdAt }
 *   message: { id, roomId, senderId, text?, image?, createdAt }
 */

import { nanoid } from "nanoid";

// phone -> user
const usersByPhone = new Map();
// userId -> user
const usersById = new Map();
// roomId -> room
const rooms = new Map();
// roomId -> message[]
const messagesByRoom = new Map();

function now() {
  return Date.now();
}

/* ---------------------------- USERS ---------------------------- */

export function upsertUser({ phone, displayName, socketId }) {
  const existing = usersByPhone.get(phone);
  if (existing) {
    existing.socketId = socketId;
    existing.online = true;
    if (displayName) existing.displayName = displayName;
    return existing;
  }
  const user = {
    id: nanoid(10),
    socketId,
    phone,
    displayName: displayName || phone,
    online: true,
  };
  usersByPhone.set(phone, user);
  usersById.set(user.id, user);
  return user;
}

export function setUserOffline(socketId) {
  const user = getUserBySocketId(socketId);
  if (user) user.online = false;
  return user;
}

export function getUserBySocketId(socketId) {
  for (const u of usersById.values()) {
    if (u.socketId === socketId) return u;
  }
  return null;
}

export function getUserById(userId) {
  return usersById.get(userId) || null;
}

export function listOnlineUsers(excludeUserId) {
  return [...usersById.values()].filter(
    (u) => u.online && u.id !== excludeUserId
  );
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, displayName: u.displayName, phone: u.phone, online: u.online };
}

/* ---------------------------- ROOMS ---------------------------- */

/**
 * Deterministic DM room id: two members always resolve to the same room
 * regardless of who initiates, and no third party can guess it without
 * knowing both member ids.
 */
export function dmRoomId(userIdA, userIdB) {
  return "dm_" + [userIdA, userIdB].sort().join("_");
}

export function getOrCreateDmRoom(userIdA, userIdB) {
  const id = dmRoomId(userIdA, userIdB);
  let room = rooms.get(id);
  if (!room) {
    room = {
      id,
      type: "dm",
      memberIds: [userIdA, userIdB],
      createdAt: now(),
    };
    rooms.set(id, room);
    messagesByRoom.set(id, []);
  }
  return room;
}

export function createGroupRoom({ name, memberIds, creatorId }) {
  const id = "grp_" + nanoid(12);
  const uniqueMembers = [...new Set([creatorId, ...memberIds])];
  const room = {
    id,
    type: "group",
    name: name?.trim() || "Unnamed Group",
    memberIds: uniqueMembers,
    createdAt: now(),
  };
  rooms.set(id, room);
  messagesByRoom.set(id, []);
  return room;
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function isMember(roomId, userId) {
  const room = getRoom(roomId);
  return !!room && room.memberIds.includes(userId);
}

export function roomsForUser(userId) {
  return [...rooms.values()].filter((r) => r.memberIds.includes(userId));
}

/* --------------------------- MESSAGES --------------------------- */

export function addMessage({ roomId, senderId, text, image }) {
  const message = {
    id: nanoid(14),
    roomId,
    senderId,
    text: text || null,
    image: image || null, // { dataUrl, name, mime } - small demo payloads only
    createdAt: now(),
  };
  const list = messagesByRoom.get(roomId) || [];
  list.push(message);
  messagesByRoom.set(roomId, list);
  return message;
}

export function getMessages(roomId, limit = 200) {
  const list = messagesByRoom.get(roomId) || [];
  return list.slice(-limit);
}
