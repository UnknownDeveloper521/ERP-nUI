import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { supabase, getUserFromAccessToken } from "./supabase";

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
  const { data, error } = await supabase
    .from("chat_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error || !data) {
    const err = new Error("Not a member of this room");
    (err as any).status = 403;
    throw err;
  }
}

async function ensureDirectRoom(userA: string, userB: string) {
  // First, try to find an existing private room between these two users
  const { data: userARooms } = await supabase
    .from("chat_members")
    .select("room_id")
    .eq("user_id", userA);

  const { data: userBRooms } = await supabase
    .from("chat_members")
    .select("room_id")
    .eq("user_id", userB);

  if (userARooms && userBRooms) {
    const userARoomIds = new Set(userARooms.map((r) => r.room_id));
    const commonRoomIds = userBRooms
      .filter((r) => userARoomIds.has(r.room_id))
      .map((r) => r.room_id);

    for (const roomId of commonRoomIds) {
      const { data: room } = await supabase
        .from("chat_rooms")
        .select("id, type")
        .eq("id", roomId)
        .eq("type", "private")
        .single();

      if (room) {
        // Verify it's a 2-person private room
        const { count } = await supabase
          .from("chat_members")
          .select("*", { count: "exact", head: true })
          .eq("room_id", roomId);

        if (count === 2) {
          return room.id as string;
        }
      }
    }
  }

  // No existing room found, create a new one
  const { data: newRoom, error: roomError } = await supabase
    .from("chat_rooms")
    .insert({ type: "private", created_by: userA })
    .select("id")
    .single();

  if (roomError || !newRoom) {
    throw new Error("Failed to create chat room: " + (roomError?.message || "Unknown error"));
  }

  const roomId = newRoom.id as string;

  // Add both users as members
  const { error: memberError } = await supabase.from("chat_members").insert([
    { room_id: roomId, user_id: userA },
    { room_id: roomId, user_id: userB },
  ]);

  if (memberError) {
    console.error("Failed to add members:", memberError);
  }

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
      try {
        const roomId = payload?.roomId;
        if (!roomId) throw new Error("roomId required");
        await assertMember(roomId, userId);
        await socket.join(roomId);
        socket.emit("rooms:joined", { roomId });
      } catch (e: any) {
        console.error("rooms:join failed", e?.message);
      }
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
          console.error("rooms:dm:ensure failed", e?.message);
          ack?.({ error: e?.message || "Failed to ensure DM room" });
        }
      }
    );

    socket.on("rooms:leave", async (payload: { roomId: string }) => {
      try {
        const roomId = payload?.roomId;
        if (!roomId) throw new Error("roomId required");
        await socket.leave(roomId);
        socket.emit("rooms:left", { roomId });
      } catch (e: any) {
        console.error("rooms:leave failed", e?.message);
      }
    });

    socket.on(
      "typing",
      async (payload: { roomId: string; isTyping: boolean }) => {
        try {
          const roomId = payload?.roomId;
          if (!roomId) throw new Error("roomId required");
          await assertMember(roomId, userId);
          socket.to(roomId).emit("typing", {
            roomId,
            userId,
            isTyping: !!payload?.isTyping,
          });
        } catch (e: any) {
          console.error("typing failed", e?.message);
        }
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
        try {
          const roomId = payload?.roomId;
          if (!roomId) throw new Error("roomId required");
          if (!payload?.content && !payload?.fileUrl) {
            throw new Error("content or fileUrl required");
          }

          await assertMember(roomId, userId);

          const { data: msg, error } = await supabase
            .from("messages")
            .insert({
              room_id: roomId,
              sender_id: userId,
              content: payload.content || null,
              file_url: payload.fileUrl || null,
            })
            .select("id, room_id, sender_id, content, file_url, created_at, seen")
            .single();

          if (error) {
            throw new Error("Failed to send message: " + error.message);
          }

          io.to(roomId).emit("messages:new", {
            ...msg,
            clientId: payload.clientId,
          });
        } catch (e: any) {
          console.error("messages:send failed", e?.message);
        }
      }
    );

    socket.on(
      "messages:seen",
      async (payload: { roomId: string; messageId: string }) => {
        try {
          const roomId = payload?.roomId;
          const messageId = payload?.messageId;
          if (!roomId || !messageId) throw new Error("roomId and messageId required");

          await assertMember(roomId, userId);

          await supabase.from("message_reads").upsert(
            { message_id: messageId, user_id: userId },
            { onConflict: "message_id,user_id" }
          );

          await supabase
            .from("chat_members")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("room_id", roomId)
            .eq("user_id", userId);

          io.to(roomId).emit("messages:seen", {
            roomId,
            messageId,
            userId,
            readAt: new Date().toISOString(),
          });
        } catch (e: any) {
          console.error("messages:seen failed", e?.message);
        }
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
