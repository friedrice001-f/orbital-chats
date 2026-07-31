import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { socket } from "../lib/socket";
import type {
  ChatMessage,
  CreateGroupResult,
  ImagePayload,
  LoginResult,
  OpenDmResult,
  PublicUser,
  RoomSummary,
  SendMessageResult,
  TypingEvent,
} from "../types";

interface ChatContextValue {
  currentUser: PublicUser | null;
  onlineUsers: PublicUser[];
  rooms: RoomSummary[];
  activeRoomId: string | null;
  messagesByRoom: Record<string, ChatMessage[]>;
  unreadRoomIds: Set<string>;
  typingByRoom: Record<string, string[]>;
  isConnecting: boolean;
  login: (phone: string, displayName: string) => Promise<LoginResult>;
  openDm: (peerId: string) => Promise<void>;
  createGroup: (name: string, memberIds: string[]) => Promise<void>;
  selectRoom: (roomId: string) => void;
  sendMessage: (roomId: string, text: string, image?: ImagePayload | null) => Promise<void>;
  setTyping: (roomId: string, isTyping: boolean) => void;
  logout: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PublicUser[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [unreadRoomIds, setUnreadRoomIds] = useState<Set<string>>(new Set());
  const [typingByRoom, setTypingByRoom] = useState<Record<string, string[]>>({});
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("orbital-chat:session");
    if (saved) {
      const { phone, displayName } = JSON.parse(saved);
      login(phone, displayName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRoomIdRef = useRef<string | null>(null);
  activeRoomIdRef.current = activeRoomId;

  useEffect(() => {
    function handlePresence(users: PublicUser[]) {
      setOnlineUsers(users);
    }

    function handleNewMessage(message: ChatMessage) {
      setMessagesByRoom((prev) => {
        const list = prev[message.roomId] || [];
        return { ...prev, [message.roomId]: [...list, message] };
      });

      if (
        message.roomId !== activeRoomIdRef.current &&
        message.senderId !== currentUserIdRef.current
      ) {
        setUnreadRoomIds((prev) => new Set(prev).add(message.roomId));
      }
    }

    function handleRoomCreated(room: RoomSummary) {
      setRooms((prev) => {
        if (prev.some((r) => r.id === room.id)) return prev;
        return [...prev, room];
      });
      setMessagesByRoom((prev) => ({ ...prev, [room.id]: prev[room.id] || [] }));
    }

    function handleTyping({ roomId, userId, isTyping }: TypingEvent) {
      const user = onlineUsersRef.current.find((u) => u.id === userId);
      const name = user?.displayName || "Someone";
      setTypingByRoom((prev) => {
        const current = new Set(prev[roomId] || []);
        if (isTyping) current.add(name);
        else current.delete(name);
        return { ...prev, [roomId]: [...current] };
      });
    }

    socket.on("presence:update", handlePresence);
    socket.on("message:new", handleNewMessage);
    socket.on("room:created", handleRoomCreated);
    socket.on("typing:update", handleTyping);

    return () => {
      socket.off("presence:update", handlePresence);
      socket.off("message:new", handleNewMessage);
      socket.off("room:created", handleRoomCreated);
      socket.off("typing:update", handleTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = currentUser?.id || null;
  const onlineUsersRef = useRef<PublicUser[]>([]);
  onlineUsersRef.current = onlineUsers;
  const credentialsRef = useRef<{ phone: string; displayName: string } | null>(null);
  useEffect(() => {
    function handleConnect() {
      // Only re-identify if we were already logged in before this — the
      // very first login is handled by login() itself.
       if (currentUserIdRef.current && credentialsRef.current) {
      socket.emit("auth:login", credentialsRef.current, (result: LoginResult) => {
        if (result.ok && result.user) {
          setCurrentUser(result.user);
          setRooms(result.rooms || []);
          setOnlineUsers(result.onlineUsers || []);
        }
      });
    }
  }
  socket.on("connect", handleConnect);
  return () => {
    socket.off("connect", handleConnect);
  };
}, []);
  
  const login = useCallback(async (phone: string, displayName: string) => {
    credentialsRef.current = { phone, displayName };
    setIsConnecting(true);
    return new Promise<LoginResult>((resolve) => {
      if (!socket.connected) socket.connect();

      socket.once("connect", () => {
        socket.emit("auth:login", { phone, displayName }, (result: LoginResult) => {
          setIsConnecting(false);
          if (result.ok && result.user) {
            setCurrentUser(result.user);
            setRooms(result.rooms || []);
            setOnlineUsers(result.onlineUsers || []);
            localStorage.setItem("orbital-chat:session", JSON.stringify({ phone, displayName }));
          }
          resolve(result);
        });
      });

      if (socket.connected) {
        socket.emit("auth:login", { phone, displayName }, (result: LoginResult) => {
          setIsConnecting(false);
          if (result.ok && result.user) {
            setCurrentUser(result.user);
            setRooms(result.rooms || []);
            setOnlineUsers(result.onlineUsers || []);
            localStorage.setItem("orbital-chat:session", JSON.stringify({ phone, displayName }));
          }
          resolve(result);
        });
      }
    });
  }, []);

  const openDm = useCallback(async (peerId: string) => {
    return new Promise<void>((resolve) => {
      socket.emit("room:openDm", { peerId }, (result: OpenDmResult) => {
        if (result.ok && result.room) {
          setRooms((prev) => {
            if (prev.some((r) => r.id === result.room!.id)) return prev;
            return [...prev, result.room!];
          });
          setMessagesByRoom((prev) => ({
            ...prev,
            [result.room!.id]: result.history || [],
          }));
          setActiveRoomId(result.room.id);
          setUnreadRoomIds((prev) => {
            const next = new Set(prev);
            next.delete(result.room!.id);
            return next;
          });
        }
        resolve();
      });
    });
  }, []);

  const createGroup = useCallback(async (name: string, memberIds: string[]) => {
    return new Promise<void>((resolve) => {
      socket.emit("room:createGroup", { name, memberIds }, (result: CreateGroupResult) => {
        if (result.ok && result.room) {
          setRooms((prev) => [...prev, result.room!]);
          setMessagesByRoom((prev) => ({ ...prev, [result.room!.id]: result.history || [] }));
          setActiveRoomId(result.room.id);
        }
        resolve();
      });
    });
  }, []);

  const selectRoom = useCallback((roomId: string) => {
    setActiveRoomId(roomId);
    setUnreadRoomIds((prev) => {
      if (!prev.has(roomId)) return prev;
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    async (roomId: string, text: string, image?: ImagePayload | null) => {
      return new Promise<void>((resolve) => {
        socket.emit(
          "message:send",
          { roomId, text: text || null, image: image || null },
          (_result: SendMessageResult) => resolve()
        );
      });
    },
    []
  );

  const setTyping = useCallback((roomId: string, isTyping: boolean) => {
    socket.emit("typing:update", { roomId, isTyping });
  }, []);

  const logout = useCallback(() => {
    socket.disconnect();
    setCurrentUser(null);
    setOnlineUsers([]);
    setRooms([]);
    setActiveRoomId(null);
    setMessagesByRoom({});
    setUnreadRoomIds(new Set());
    setTypingByRoom({});
    localStorage.removeItem("orbital-chat:session");
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      currentUser,
      onlineUsers,
      rooms,
      activeRoomId,
      messagesByRoom,
      unreadRoomIds,
      typingByRoom,
      isConnecting,
      login,
      openDm,
      createGroup,
      selectRoom,
      sendMessage,
      setTyping,
      logout,
    }),
    [
      currentUser,
      onlineUsers,
      rooms,
      activeRoomId,
      messagesByRoom,
      unreadRoomIds,
      typingByRoom,
      isConnecting,
      login,
      openDm,
      createGroup,
      selectRoom,
      sendMessage,
      setTyping,
      logout,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
