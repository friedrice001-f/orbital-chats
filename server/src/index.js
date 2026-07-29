import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import * as store from "./store.js";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Basic phone number sanity check — this is identity-only, NOT real
// SMS/OTP verification. Wiring up real verification requires a paid
// provider (e.g. Twilio Verify) and is out of scope for this demo.
const PHONE_RE = /^\+?[0-9]{7,15}$/;

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "8mb" })); // headroom for base64 image payloads

app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
  maxHttpBufferSize: 8 * 1024 * 1024, // allow image payloads over the socket
});

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
    socket.join(user.id); // personal channel for cross-device / re-login delivery

    // Join every room this user already belongs to
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
    // Also add the peer's active socket to the room so they receive events
    // immediately (their own client will also join on their session).
    const peerSocket = io.sockets.sockets.get(peer.socketId);
    peerSocket?.join(room.id);

    const history = store.getMessages(room.id);
    callback?.({ ok: true, room: roomView(room, currentUser.id), history });

    // Let the peer know a DM room now exists with them, in case it's new.
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
    // Guard against oversized inline image payloads (demo-scale only).
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

  /* -------------------------- DISCONNECT --------------------------- */
  socket.on("disconnect", () => {
    if (!currentUser) return;
    store.setUserOffline(socket.id);
    broadcastPresence();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Orbital Chat server listening on port ${PORT}`);
});
