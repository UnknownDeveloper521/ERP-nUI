import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { pool } from "./db";
import { getUserFromAccessToken } from "./supabase";

type AuthedSocket = Parameters<NonNullable<Parameters<Server["use"]>[0]>>[0] & {
  data: {
    userId?: string;
    email?: string;
  };
};

type OnlineUser = {
  userId: string;
  sockets: Set<string>;
};

const onlineUsers = new Map<string, OnlineUser>();

function setUserOnline(userId: string, socketId: string) {
  const current = onlineUsers.get(userId);
  if (!current) {
    onlineUsers.set(userId, { userId, sockets: new Set([socketId]) });
    return true;
  }
  current.sockets.add(socketId);
  return false;
}

function setUserOffline(userId: string, socketId: string) {
  const current = onlineUsers.get(userId);
  if (!current) return false;
  current.sockets.delete(socketId);
  if (current.sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

async function assertMember(roomId: string, userId: string) {
  const { rowCount } = await pool.query(
    "select 1 from public.chat_members where room_id = $1 and user_id = $2 limit 1",
    [roomId, userId]
  );
  if (!rowCount) {
    const err = new Error("Not a member of this room");
    (err as any).status = 403;
    throw err;
  }
}

async function ensureDirectRoom(userA: string, userB: string) {
  const { rows: existingRows } = await pool.query(
    `
    select r.id
    from public.chat_rooms r
    join public.chat_members m on m.room_id = r.id
    where r.type = 'private'
    group by r.id
    having count(distinct m.user_id) = 2
       and sum(case when m.user_id = $1 then 1 else 0 end) = 1
       and sum(case when m.user_id = $2 then 1 else 0 end) = 1
    limit 1
    `,
    [userA, userB]
  );

  if (existingRows.length) return existingRows[0].id as string;

  const created = await pool.query(
    "insert into public.chat_rooms (type, created_by) values ('private', $1) returning id",
    [userA]
  );
  const roomId = created.rows[0].id as string;

  await pool.query(
    "insert into public.chat_members (room_id, user_id) values ($1, $2), ($1, $3) on conflict do nothing",
    [roomId, userA, userB]
  );

  return roomId;
}

export function setupSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(async (socket: AuthedSocket, next) => {
    try {
      const accessToken =
        (socket.handshake.auth?.accessToken as string | undefined) ||
        (socket.handshake.headers.authorization?.toString().startsWith("Bearer ")
          ? socket.handshake.headers.authorization.toString().slice("Bearer ".length)
          : undefined);

      if (!accessToken) return next(new Error("Missing access token"));

      const user = await getUserFromAccessToken(accessToken);
      socket.data.userId = user.id;
      socket.data.email = user.email || undefined;

      return next();
    } catch (e: any) {
      return next(new Error(e?.message || "Unauthorized"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    const userId = socket.data.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    const becameOnline = setUserOnline(userId, socket.id);
    if (becameOnline) {
      io.emit("presence:update", { userId, online: true });
    }

    socket.emit("presence:state", {
      onlineUserIds: Array.from(onlineUsers.keys()),
    });

    socket.on("rooms:join", async (payload: { roomId: string }) => {
      const roomId = payload?.roomId;
      if (!roomId) throw new Error("roomId required");
      await assertMember(roomId, userId);
      await socket.join(roomId);
      socket.emit("rooms:joined", { roomId });
    });

    socket.on(
      "rooms:dm:ensure",
      async (
        payload: { otherUserId: string },
        ack?: (response: { roomId?: string; error?: string }) => void
      ) => {
        try {
          const otherUserId = payload?.otherUserId;
          if (!otherUserId) throw new Error("otherUserId required");
          if (otherUserId === userId) throw new Error("Cannot DM yourself");

          const roomId = await ensureDirectRoom(userId, otherUserId);
          await socket.join(roomId);
          ack?.({ roomId });
        } catch (e: any) {
          ack?.({ error: e?.message || "Failed to ensure DM room" });
        }
      }
    );

    socket.on("rooms:leave", async (payload: { roomId: string }) => {
      const roomId = payload?.roomId;
      if (!roomId) throw new Error("roomId required");
      await socket.leave(roomId);
      socket.emit("rooms:left", { roomId });
    });

    socket.on(
      "typing",
      async (payload: { roomId: string; isTyping: boolean }) => {
        const roomId = payload?.roomId;
        if (!roomId) throw new Error("roomId required");
        await assertMember(roomId, userId);
        socket.to(roomId).emit("typing", {
          roomId,
          userId,
          isTyping: !!payload?.isTyping,
        });
      }
    );

    socket.on(
      "messages:send",
      async (payload: {
        roomId: string;
        content?: string;
        fileUrl?: string;
        clientId?: string;
      }) => {
        const roomId = payload?.roomId;
        if (!roomId) throw new Error("roomId required");
        if (!payload?.content && !payload?.fileUrl) {
          throw new Error("content or fileUrl required");
        }

        await assertMember(roomId, userId);

        const result = await pool.query(
          "insert into public.messages (room_id, sender_id, content, file_url) values ($1, $2, $3, $4) returning id, room_id, sender_id, content, file_url, created_at, seen",
          [roomId, userId, payload.content || null, payload.fileUrl || null]
        );

        const msg = result.rows[0];
        io.to(roomId).emit("messages:new", {
          ...msg,
          clientId: payload.clientId,
        });
      }
    );

    socket.on(
      "messages:seen",
      async (payload: { roomId: string; messageId: string }) => {
        const roomId = payload?.roomId;
        const messageId = payload?.messageId;
        if (!roomId || !messageId) throw new Error("roomId and messageId required");

        await assertMember(roomId, userId);

        await pool.query(
          "insert into public.message_reads (message_id, user_id) values ($1, $2) on conflict (message_id, user_id) do nothing",
          [messageId, userId]
        );

        await pool.query(
          "update public.chat_members set last_seen_at = now() where room_id = $1 and user_id = $2",
          [roomId, userId]
        );

        io.to(roomId).emit("messages:seen", {
          roomId,
          messageId,
          userId,
          readAt: new Date().toISOString(),
        });
      }
    );

    socket.on("disconnect", () => {
      const becameOffline = setUserOffline(userId, socket.id);
      if (becameOffline) {
        io.emit("presence:update", { userId, online: false });
      }
    });
  });

  return io;
}
