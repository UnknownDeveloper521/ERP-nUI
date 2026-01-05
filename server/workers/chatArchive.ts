import { gzipSync } from "zlib";
import { pool } from "../db";
import { createS3Client, uploadGzipJson, type S3Config } from "./s3";

type HotMessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  created_at: string;
  expires_at: string;
};

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}

function getS3Config(): S3Config {
  return {
    endpoint: process.env.CHAT_ARCHIVE_S3_ENDPOINT,
    region: process.env.CHAT_ARCHIVE_S3_REGION || "us-east-1",
    accessKeyId: mustGetEnv("CHAT_ARCHIVE_S3_ACCESS_KEY_ID"),
    secretAccessKey: mustGetEnv("CHAT_ARCHIVE_S3_SECRET_ACCESS_KEY"),
    bucket: mustGetEnv("CHAT_ARCHIVE_S3_BUCKET"),
    prefix: process.env.CHAT_ARCHIVE_S3_PREFIX || "chat-archives",
    forcePathStyle:
      process.env.CHAT_ARCHIVE_S3_FORCE_PATH_STYLE === "true" ? true : undefined,
  };
}

function monthStartIso(d: Date) {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
  return m.toISOString();
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function buildObjectKey(roomId: string, monthStart: Date) {
  const yyyy = monthStart.getUTCFullYear();
  const mm = pad2(monthStart.getUTCMonth() + 1);
  const ts = Date.now();
  return `room=${roomId}/year=${yyyy}/month=${mm}/batch-${ts}.json.gz`;
}

async function loadExpiredBatch(limit: number): Promise<HotMessageRow[]> {
  const result = await pool.query<HotMessageRow>(
    `
    select id, room_id, sender_id, content, file_url, created_at, expires_at
    from public.messages
    where expires_at < now()
      and archived = false
    order by room_id, created_at asc
    limit $1
    `,
    [limit]
  );
  return result.rows;
}

export async function runArchiveOnce() {
  const batchSize = Number(process.env.CHAT_ARCHIVE_BATCH_SIZE || 5000);
  const rows = await loadExpiredBatch(batchSize);
  if (rows.length === 0) {
    console.log("[chat:archive] no expired messages");
    return;
  }

  const cfg = getS3Config();
  const s3 = createS3Client(cfg);

  // Group by room + month
  const groups = new Map<string, HotMessageRow[]>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const monthStart = monthStartIso(d);
    const k = `${r.room_id}::${monthStart}`;
    const arr = groups.get(k);
    if (arr) arr.push(r);
    else groups.set(k, [r]);
  }

  for (const [k, msgs] of groups.entries()) {
    const [roomId, monthIso] = k.split("::");
    const monthStart = new Date(monthIso);

    const payload = {
      room_id: roomId,
      month_start: monthIso,
      exported_at: new Date().toISOString(),
      messages: msgs.map((m) => ({
        id: m.id,
        room_id: m.room_id,
        sender_id: m.sender_id,
        content: m.content,
        file_url: m.file_url,
        created_at: m.created_at,
      })),
    };

    const gz = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
    const objectKey = buildObjectKey(roomId, monthStart);
    const fullKey = await uploadGzipJson(s3, cfg, objectKey, gz);

    const minCreatedAt = msgs[0].created_at;
    const maxCreatedAt = msgs[msgs.length - 1].created_at;

    const ids = msgs.map((m) => m.id);

    // Persist manifest + mark archived + delete from HOT
    // NOTE: Update-by-id is allowed even without a global PK because id is still stored.
    const client = await pool.connect();
    try {
      await client.query("begin");

      await client.query(
        `
        insert into public.chat_message_archives
          (room_id, month_start, object_key, content_encoding, message_count, min_created_at, max_created_at)
        values ($1, $2, $3, 'gzip', $4, $5, $6)
        `,
        [roomId, monthIso, fullKey, msgs.length, minCreatedAt, maxCreatedAt]
      );

      await client.query(
        `
        update public.messages
        set archived = true,
            archive_key = $2
        where id = any($1::uuid[])
        `,
        [ids, fullKey]
      );

      await client.query(
        `
        delete from public.messages
        where id = any($1::uuid[])
        `,
        [ids]
      );

      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }

    console.log(
      `[chat:archive] archived room=${roomId} month=${monthIso} messages=${msgs.length} key=${fullKey}`
    );
  }
}

if (process.argv[1]?.includes("chatArchive")) {
  runArchiveOnce().catch((e) => {
    console.error("[chat:archive] failed", e);
    process.exitCode = 1;
  });
}
