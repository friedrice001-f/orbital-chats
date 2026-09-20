import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import * as store from "./store.js";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const PHONE_RE = /^\+?[0-9]{7,15}$/;

// Image limits (must stay in step with the limits in MessageInput.tsx)
const MAX_IMAGES_PER_MESSAGE = 10;
const MAX_IMAGE_DATAURL_CHARS = 7_000_000; // ~5MB file once base64-encoded
const MAX_TOTAL_DATAURL_CHARS = 28_000_000; // ~20MB of files once base64-encoded

const allowedOrigin = (origin, callback) => {
  if (
    !origin ||
    origin === CLIENT_ORIGIN ||
    origin.endsWith(".app.github.dev") ||
    origin === "https://orbital-chats.onrender.com"
  ) {
    return callback(null, true);
  }
  callback(new Error("Not allowed by CORS"));
};

const app = express();
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST"] },
  // Several photos in one message need far more room than the old 8MB.
  maxHttpBufferSize: 32 * 1024 * 1024,
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

// Turns whatever the client sent (`images` array and/or legacy `image`) into a
// clean array of { dataUrl, name, mime }. Returns { images } or { error }.
function normalizeImages(images, image) {
  let list = [];
  if (Array.isArray(images) && images.length > 0) list = images;
  else if (image) list = [image];

  if (list.length > MAX_IMAGES_PER_MESSAGE) {
    return { error: `You can send up to ${MAX_IMAGES_PER_MESSAGE} photos at once.` };
  }

  const cleaned = [];
  let total = 0;
  for (const img of list) {
    if (!img || typeof img.dataUrl !== "string" || !img.dataUrl.startsWith("data:image/")) {
      return { error: "Invalid image." };
    }
    if (img.dataUrl.length > MAX_IMAGE_DATAURL_CHARS) {
      return { error: "Image is too large." };
    }
    total += img.dataUrl.length;
    if (total > MAX_TOTAL_DATAURL_CHARS) {
      return { error: "Photos are too large in total. Send fewer at once." };
    }
    cleaned.push({
      dataUrl: img.dataUrl,
      name: typeof img.name === "string" ? img.name : "image",
      mime: typeof img.mime === "string" ? img.mime : "image/jpeg",
    });
  }
  return { images: cleaned };
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
  socket.on("message:send", ({ roomId, text, image, images }, callback) => {
    if (!currentUser) return callback?.({ ok: false, error: "Not authenticated." });
    if (!store.isMember(roomId, currentUser.id)) {
      return callback?.({ ok: false, error: "You are not part of this conversation." });
    }

    const normalized = normalizeImages(images, image);
    if (normalized.error) {
      return callback?.({ ok: false, error: normalized.error });
    }
    const cleanImages = normalized.images;

    if (!text && cleanImages.length === 0) {
      return callback?.({ ok: false, error: "Empty message." });
    }

    const message = store.addMessage({
      roomId,
      senderId: currentUser.id,
      text,
      // `image` (first photo) keeps older clients and store.js working
      image: cleanImages[0] || null,
      images: cleanImages.length > 0 ? cleanImages : undefined,
    });

    // If store.addMessage doesn't copy the `images` field itself, add it here so
    // it is still sent live (and kept in history, since it is the stored object).
    if (cleanImages.length > 0 && !message.images) {
      message.images = cleanImages;
    }

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
  socket.on("call:invite", ({ toUserId, offer, callType }, callback) => {
    console.log("[call:invite] from", currentUser?.id, "to", toUserId);
    if (!currentUser) return callback?.({ ok: false, error: "Not authenticated." });
    const target = store.getUserById(toUserId);
    console.log("[call:invite] target found?", !!target, "online?", target?.online);
    if (!target || !target.online) {
      return callback?.({ ok: false, error: "User is offline." });
    }

    if (activeCallPeer.has(toUserId) || activeCallPeer.has(currentUser.id)) {
      return callback?.({ ok: false, error: "User is busy." });
    }
    const targetSocket = io.sockets.sockets.get(target.socketId);
    console.log("[call:invite] targetSocket found?", !!targetSocket);
    if (!targetSocket) {
      return callback?.({ ok: false, error: "User is offline." });
    }
    activeCallPeer.set(currentUser.id, toUserId);
    activeCallPeer.set(toUserId, currentUser.id);
    targetSocket.emit("call:incoming", {
      fromUserId: currentUser.id,
      fromName: currentUser.displayName,
      offer,
      callType: callType || "voice",
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
    store.setUserOffline(socket.id);
    broadcastPresence();

    const userId = currentUser.id;
    const disconnectedSocketId = socket.id;
    if (!activeCallPeer.has(userId)) return;

    setTimeout(() => {
      const user = store.getUserById(userId);
      if (user && user.socketId !== disconnectedSocketId) return;
      const peerId = endCallFor(userId);
      if (peerId) {
        const peer = store.getUserById(peerId);
        const peerSocket = peer && io.sockets.sockets.get(peer.socketId);
        peerSocket?.emit("call:ended", { fromUserId: userId });
      }
    }, 5000);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Orbital Chat server listening on port ${PORT}`);
});