import { Server as SocketServer, Socket } from "socket.io";

export function createRealTimeManager(server: SocketServer) {
  const connections = new Map<string, Socket>();

  server.on("connection", (socket) => {
    const userId = socket.handshake.query.userId as string;
    const lastSyncId = socket.handshake.query.lastSyncId;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    connections.set(userId, socket);

    socket.on("disconnect", () => {
      connections.delete(userId);
    });
  });

  function requestEveryoneToSync() {
    for (const socket of connections.values()) {
      socket.emit("sync trigger");
    }
  }

  return {
    requestEveryoneToSync,
  };
}

export type RealTimeManager = ReturnType<typeof createRealTimeManager>;
