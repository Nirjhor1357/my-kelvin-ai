import { io, Socket } from "socket.io-client";

export function createJarvisSocket(baseUrl: string): Socket {
  return io(baseUrl, {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true
  });
}
