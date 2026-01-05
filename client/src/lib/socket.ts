import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  return socket;
}

export function connectSocket(accessToken: string) {
  if (socket?.connected) return socket;

  socket = io({
    path: "/socket.io",
    transports: ["websocket"],
    auth: {
      accessToken,
    },
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
