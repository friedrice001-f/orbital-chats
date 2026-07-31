import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import * as store from "./store.js";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const PHONE_RE = /^\+?[0-9]{7,15}$/;

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
  maxHttpBufferSize: 8 * 1024 * 1024,
});

// userId -> peerUserId, tracks who's currently on a call so we can reject
// new invites as "busy" and clean up properly on disconnect.
const activeCallPeer = new Map();

function endCallFor(userId) {
  const peerId = activeCallPeer.get(userId);
  if (peerId) {
    activeCallPeer.delete(userId);
    activeCallPeer.delete(peerId);
  }
  return peerId;
}

function broadcastPresence() {
  const online = store.listOnlineUsers().map(store.publicUser);
  io.emit("presence:update", online);
}

function roomView(room, forUserId) {
  if (room.type === "dm") {
    const otherId = room.memberIds.find((id) => id !== forUserId);
    const other = store.getUserById(otherId);
    return {
      id: room.id,
      type: "dm",
      name: other?.displayName || "Unknown",
      memberIds: room.memberIds,
    };
  }
  return {
    id: room.id,
    type: "group",
    name: room.name,
    memberIds: room.memberIds,
  };
}

io.on("connection", (socket) => {
  let currentUser = null;

  /* ------------------------- AUTH / LOGIN ------------------------- */
  socket.on("auth:login", ({ phone, displayName }, callback) => {
    if (!phone || !PHONE_RE.test(phone.trim())) {
      return callback?.({ ok: false, error: "Enter a valid phone number." });
    }
    const user = store.upsertUser({
      phone: phone.trim(),
      displayName: displayName?.trim(),
      socketId: socket.id,
    });
    currentUser = user;
    socket.join(user.id);

    for (const room of store.roomsForUser(user.id)) {
      socket.join(room.id);
    }

    const myRooms = store.roomsForUser(user.id).map((r) => roomView(r, user.id));

    callback?.({
      ok: true,
      user: store.publicUser(user),
      rooms: myRooms,
      onlineUsers: store.listOnlineUsers(user.id).map(store.publicUser),
    });

    broadcastPresence();
  });

  /* --------------------------- DM ROOMS --------------------------- */
  socket.on("room:openDm", ({ peerId }, callback) => {
    if (!currentUser) return callback?.({ ok: false, error: "Not authenticated." });
    const peer = store.getUserById(peerId);
    if (!peer) return callback?.({ ok: false, error: "User not found." });

    const room = store.getOrCreateDmRoom(currentUser.id, peerId);
    socket.join(room.id);
    const peerSocket = io.sockets.sockets.get(peer.socketId);
    peerSocket?.join(room.id);

    const history = store.getMessages(room.id);
    callback?.({ ok: true, room: roomView(room, currentUser.id), history });

    peerSocket?.emit("room:created", roomView(room, peer.id));
  });

  /* ------------------------- GROUP ROOMS ------------------------- */
  socket.on("room:createGroup", ({ name, memberIds }, callback) => {
    if (!currentUser) return callback?.({ ok: false, error: "Not authenticated." });
    if (!Array.isArray(memberIds) || memberIds.length < 1) {
      return callback?.({ ok: false, error: "Select at least one member." });
    }

    const room = store.createGroupRoom({
      name,
      memberIds,
      creatorId: currentUser.id,
    });

    for (const memberId of room.memberIds) {
      const member = store.getUserById(memberId);
      const memberSocket = member && io.sockets.sockets.get(member.socketId);
      memberSocket?.join(room.id);
      if (member && member.id !== currentUser.id) {
        memberSocket?.emit("room:created", roomView(room, member.id));
      }
    }

    callback?.({ ok: true, room: roomView(room, currentUser.id), history: [] });
  });

  /* ---------------------------- MESSAGES --------------------------- */
  socket.on("message:send", ({ roomId, text, image }, callback) => {
    if (!currentUser) return callback?.({ ok: false, error: "Not authenticated." });
    if (!store.isMember(roomId, currentUser.id)) {
      return callback?.({ ok: false, error: "You are not part of this conversation." });
    }
    if (!text && !image) {
      return callback?.({ ok: false, error: "Empty message." });
    }
    if (image?.dataUrl && image.dataUrl.length > 6_000_000) {
      return callback?.({ ok: false, error: "Image is too large." });
    }

    const message = store.addMessage({
      roomId,
      senderId: currentUser.id,
      text,
      image,
    });

    io.to(roomId).emit("message:new", message);
    callback?.({ ok: true, message });
  });

  socket.on("typing:update", ({ roomId, isTyping }) => {
    if (!currentUser || !store.isMember(roomId, currentUser.id)) return;
    socket.to(roomId).emit("typing:update", {
      roomId,
      userId: currentUser.id,
      isTyping: !!isTyping,
    });
  });

  /* ---------------------------- CALLS ------------------------------ */
  socket.on("call:invite", ({ toUserId, offer }, callback) => {
    if (!currentUser) return callback?.({ ok: false, error: "Not authenticated." });
    const target = store.getUserById(toUserId);
    if (!target || !target.online) {
      return callback?.({ ok: false, error: "User is offline." });
    }
    if (activeCallPeer.has(toUserId) || activeCallPeer.has(currentUser.id)) {
      return callback?.({ ok: false, error: "User is busy." });
    }
    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (!targetSocket) {
      return callback?.({ ok: false, error: "User is offline." });
    }
    activeCallPeer.set(currentUser.id, toUserId);
    activeCallPeer.set(toUserId, currentUser.id);
    targetSocket.emit("call:incoming", {
      fromUserId: currentUser.id,
      fromName: currentUser.displayName,
      offer,
    });
    callback?.({ ok: true });
  });

  socket.on("call:accept", ({ toUserId, answer }) => {
    if (!currentUser) return;
    const target = store.getUserById(toUserId);
    const targetSocket = target && io.sockets.sockets.get(target.socketId);
    targetSocket?.emit("call:accepted", { fromUserId: currentUser.id, answer });
  });

  socket.on("call:reject", ({ toUserId }) => {
    if (!currentUser) return;
    endCallFor(currentUser.id);
    const target = store.getUserById(toUserId);
    const targetSocket = target && io.sockets.sockets.get(target.socketId);
    targetSocket?.emit("call:rejected", { fromUserId: currentUser.id });
  });

  socket.on("call:end", ({ toUserId }) => {
    if (!currentUser) return;
    endCallFor(currentUser.id);
    const target = store.getUserById(toUserId);
    const targetSocket = target && io.sockets.sockets.get(target.socketId);
    targetSocket?.emit("call:ended", { fromUserId: currentUser.id });
  });

  socket.on("call:ice-candidate", ({ toUserId, candidate }) => {
    if (!currentUser) return;
    const target = store.getUserById(toUserId);
    const targetSocket = target && io.sockets.sockets.get(target.socketId);
    targetSocket?.emit("call:ice-candidate", { fromUserId: currentUser.id, candidate });
  });

  /* -------------------------- DISCONNECT --------------------------- */
  socket.on("disconnect", () => {
    if (!currentUser) return;
    const peerId = endCallFor(currentUser.id);
    if (peerId) {
      const peer = store.getUserById(peerId);
      const peerSocket = peer && io.sockets.sockets.get(peer.socketId);
      peerSocket?.emit("call:ended", { fromUserId: currentUser.id });
    }
    store.setUserOffline(socket.id);
    broadcastPresence();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Orbital Chat server listening on port ${PORT}`);
});
