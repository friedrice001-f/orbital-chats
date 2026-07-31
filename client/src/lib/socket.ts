import { io, Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

// A single shared socket instance for the whole app lifetime. It connects
// lazily (autoConnect: false) so we only open the connection once the user
// has entered their phone number on the login screen.
export const socket: Socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ["polling", "websocket"],
});
