import { openDB, type DBSchema } from "idb";
import type { ReportDraft } from "./types";

interface QueueDB extends DBSchema {
  pending_reports: {
    key: string; // idempotencyKey
    value: ReportDraft;
  };
}

const dbPromise = openDB<QueueDB>("emergencias-offline-queue", 1, {
  upgrade(db) {
    db.createObjectStore("pending_reports", { keyPath: "idempotencyKey" });
  },
});

export async function enqueueReport(draft: ReportDraft): Promise<void> {
  const db = await dbPromise;
  await db.put("pending_reports", draft);
}

export async function listQueuedReports(): Promise<ReportDraft[]> {
  const db = await dbPromise;
  return db.getAll("pending_reports");
}

export async function removeQueuedReport(idempotencyKey: string): Promise<void> {
  const db = await dbPromise;
  await db.delete("pending_reports", idempotencyKey);
}

export async function queueSize(): Promise<number> {
  const db = await dbPromise;
  return db.count("pending_reports");
}
