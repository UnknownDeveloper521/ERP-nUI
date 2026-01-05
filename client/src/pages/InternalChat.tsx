import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase, getAccessToken } from "@/lib/supabase";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";

type ThreadMessage = {
  id: string;
  roomId: string;
  senderId: string;
  content: string | null;
  fileUrl: string | null;
  createdAt: string;
};

type Profile = {
  id: string;
  name: string;
  department: string | null;
  role: string | null;
};

export default function InternalChat() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [onlineByUserId, setOnlineByUserId] = useState<Record<string, boolean>>({});
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const myUserIdRef = useRef<string | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAccessToken(data.session?.access_token ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const supaUser = data.user;
      if (!supaUser || !mounted) return;
      myUserIdRef.current = supaUser.id;

      // Ensure current user's profile exists
      const name = user?.name || supaUser.email?.split("@")[0] || "User";
      await supabase
        .from("users_profile")
        .upsert(
          {
            id: supaUser.id,
            name,
            department: user?.department || null,
            role: user?.role || null,
          },
          { onConflict: "id" }
        );

      const { data: rows, error } = await supabase
        .from("users_profile")
        .select("id,name,department,role")
        .order("name", { ascending: true });

      if (!mounted) return;
      if (error) {
        setProfiles([]);
        return;
      }

      setProfiles(rows || []);
    })();

    return () => {
      mounted = false;
    };
  }, [user?.name, user?.department, user?.role]);

  useEffect(() => {
    const saved = localStorage.getItem("chat:lastActiveUserId");
    if (saved && !activeUserId) {
      setActiveUserId(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeUserId) {
      localStorage.setItem("chat:lastActiveUserId", activeUserId);
    }
  }, [activeUserId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!accessToken || !mounted) return;
      const socket = connectSocket(accessToken);

      const onConnect = () => {
        setIsSocketReady(true);
      };

      const onDisconnect = () => {
        setIsSocketReady(false);
      };

      const onPresenceState = (payload: { onlineUserIds: string[] }) => {
        const ids = payload?.onlineUserIds || [];
        setOnlineByUserId((prev) => {
          const next = { ...prev };
          for (const id of ids) next[id] = true;
          return next;
        });
      };

      const onPresence = (payload: { userId: string; online: boolean }) => {
        if (!payload?.userId) return;
        setOnlineByUserId((prev) => ({
          ...prev,
          [payload.userId]: !!payload.online,
        }));
      };

      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("presence:state", onPresenceState);
      socket.on("presence:update", onPresence);
    })();

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const employees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles
      .filter((p) => (myUserIdRef.current ? p.id !== myUserIdRef.current : true))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
  }, [profiles, search]);

  const activeUser = useMemo(() => {
    if (!activeUserId) return null;
    return profiles.find((p) => p.id === activeUserId) || null;
  }, [profiles, activeUserId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!activeUserId) {
        setRoomId(null);
        setMessages([]);
        return;
      }

      if (!accessToken) return;

      const socket = getSocket() || connectSocket(accessToken);

      socket.emit(
        "rooms:dm:ensure",
        { otherUserId: activeUserId },
        async (resp: { roomId?: string; error?: string }) => {
          if (!mounted) return;
          if (!resp?.roomId) {
            // Keep UI usable even if ensure fails
            console.error("rooms:dm:ensure failed", resp?.error);
            return;
          }

          setRoomId(resp.roomId);
        }
      );
    })();

    return () => {
      mounted = false;
    };
  }, [activeUserId, accessToken]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!roomId) return;
      if (!accessToken) return;

      setIsHistoryLoading(true);
      try {
        const { data: rows, error } = await supabase
          .from("messages")
          .select("id,room_id,sender_id,content,file_url,created_at")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(100);

        if (!mounted) return;
        if (error) {
          console.error("Failed to load history", error);
          return;
        }

        setMessages(
          (rows || []).map((r: any) => ({
            id: r.id,
            roomId: r.room_id,
            senderId: r.sender_id,
            content: r.content,
            fileUrl: r.file_url,
            createdAt: r.created_at,
          }))
        );
      } finally {
        if (mounted) setIsHistoryLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [roomId, accessToken]);

  useEffect(() => {
    const root = messagesScrollRef.current;
    if (!root) return;

    const viewport = root.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement | null;
    if (!viewport) return;
    messagesViewportRef.current = viewport;

    const onScroll = () => {
      const thresholdPx = 24;
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setShouldAutoScroll(distanceFromBottom <= thresholdPx);
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [roomId]);

  const scrollMessagesToBottom = () => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  };

  useEffect(() => {
    // When a room opens (history loaded), jump to bottom.
    if (!roomId) return;
    // Let the DOM paint first.
    requestAnimationFrame(() => {
      scrollMessagesToBottom();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    // When messages change, stick to bottom only if user is already at bottom.
    if (!roomId) return;
    if (!shouldAutoScroll) return;
    requestAnimationFrame(() => {
      scrollMessagesToBottom();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, roomId, shouldAutoScroll]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (!isSocketReady) return;

    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (m: any) => {
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [
          ...prev,
          {
            id: m.id,
            roomId: m.room_id,
            senderId: m.sender_id,
            content: m.content ?? null,
            fileUrl: m.file_url ?? null,
            createdAt: m.created_at,
          },
        ];
      });
    };

    socket.on("messages:new", onNewMessage);
    return () => {
      socket.off("messages:new", onNewMessage);
    };
  }, [isSocketReady]);

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    if (!roomId) return;

    const socket = getSocket();
    if (!socket) return;

    const clientId = crypto.randomUUID();
    socket.emit("messages:send", { roomId, content, clientId });
    setDraft("");
  };

  return (
    <div className="h-full grid grid-cols-12 gap-4 min-h-0">
      <Card className="col-span-12 lg:col-span-3 border-none shadow-sm flex flex-col min-h-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Employees</CardTitle>
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent className="pt-0 flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-1">
              {employees.map((e) => {
                const isActive = e.id === activeUserId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setActiveUserId(e.id)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-muted"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${e.id}`}
                        alt={e.name}
                      />
                      <AvatarFallback>{e.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-medium">{e.name}</div>
                        <Badge variant="secondary" className="shrink-0">
                          {e.department || "General"}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{e.role || "Employee"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="col-span-12 lg:col-span-9 border-none shadow-sm flex flex-col min-h-0">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-lg truncate">
                {activeUser ? activeUser.name : "Select a user"}
              </CardTitle>
              <div className="text-sm text-muted-foreground truncate">
                {activeUser ? (activeUser.department || "General") : "Choose an employee to start chatting"}
              </div>
            </div>
            {activeUser ? (
              <Badge variant="outline">
                {onlineByUserId[activeUser.id] ? "Online" : "Offline"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="flex-1 pt-0 min-h-0 flex flex-col">
          <div ref={messagesScrollRef} className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-4">
            <div className="flex flex-col gap-3">
              {messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No messages yet.
                </div>
              ) : (
                messages
                  .filter((m) => (roomId ? m.roomId === roomId : false))
                  .map((m) => {
                  const mine = myUserIdRef.current === m.senderId;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div>{m.content}</div>
                        <div className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            </ScrollArea>
          </div>
        </CardContent>

        <div className="border-t px-4 py-3">
          <div className="flex gap-2">
            <Input
              placeholder={activeUser ? "Type a message..." : "Select a user to start"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!activeUser}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <Button onClick={send} disabled={!activeUser || !draft.trim()}>
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
