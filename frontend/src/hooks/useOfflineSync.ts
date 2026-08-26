import { useCallback, useEffect, useState } from "react";
import { submitReport } from "../lib/api";
import { listQueuedReports, queueSize, removeQueuedReport } from "../lib/offlineQueue";
import { useOnlineStatus } from "./useOnlineStatus";

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    setPendingCount(await queueSize());
  }, []);

  const flushQueue = useCallback(async () => {
    const drafts = await listQueuedReports();
    for (const draft of drafts) {
      try {
        await submitReport(draft);
        await removeQueuedReport(draft.idempotencyKey);
      } catch {
      }
    }
    await refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (isOnline) {
      flushQueue();
    }
  }, [isOnline, flushQueue]);

  return { pendingCount, flushQueue, refreshCount };
}
