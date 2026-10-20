import { 
  writeBatch, 
  doc, 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  orderBy, 
  startAfter, 
  DocumentSnapshot 
} from 'firebase/firestore';
import { firestore } from './firebase';

const BATCH_SIZE = 500;

/**
 * Get the stored last sync timestamp for a given tenant and entity
 */
export function getLastSyncTimestamp(tenantId: string, entity: string): string {
  return localStorage.getItem(`carisoft_sync_${tenantId}_${entity}`) || '1970-01-01T00:00:00.000Z';
}

/**
 * Set the stored last sync timestamp for a given tenant and entity
 */
export function setLastSyncTimestamp(tenantId: string, entity: string, timestamp: string): void {
  localStorage.setItem(`carisoft_sync_${tenantId}_${entity}`, timestamp);
}

/**
 * Push an array of items to Firestore using writeBatch in chunks of 500.
 * Runs in background and ensures strict tenant isolation (companyId).
 */
export async function pushBatchToFirestore<T extends { id: string; updatedAt?: string; companyId?: string }>(
  collectionName: string,
  items: T[],
  tenantId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; pushedCount: number; errors: string[] }> {
  if (!items || items.length === 0 || !tenantId) {
    return { success: true, pushedCount: 0, errors: [] };
  }

  const errors: string[] = [];
  let processed = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(firestore);

    for (const item of chunk) {
      if (!item.id) continue;
      const docRef = doc(firestore, collectionName, item.id);
      const payload = {
        ...item,
        companyId: tenantId,
        updatedAt: item.updatedAt || new Date().toISOString(),
      };
      batch.set(docRef, payload, { merge: true });
    }

    try {
      await batch.commit();
      processed += chunk.length;
      if (onProgress) {
        onProgress(processed, items.length);
      }
    } catch (err: any) {
      console.error(`Error committing batch ${i / BATCH_SIZE} to Firestore:`, err);
      errors.push(err?.message || 'Erreur Firestore batch commit');
    }
  }

  return {
    success: errors.length === 0,
    pushedCount: processed,
    errors,
  };
}

/**
 * Incremental pull from Firestore:
 * Only reads records modified after `lastSyncAt` with strict companyId filter.
 * Uses pagination of 500 to prevent large memory overhead.
 */
export async function pullIncrementalFromFirestore<T = any>(
  collectionName: string,
  tenantId: string,
  options?: {
    lastSyncAt?: string;
    batchLimit?: number;
    onBatch?: (records: T[]) => Promise<void>;
  }
): Promise<{ count: number; newestUpdatedAt: string }> {
  if (!tenantId) {
    return { count: 0, newestUpdatedAt: '' };
  }

  const since = options?.lastSyncAt || getLastSyncTimestamp(tenantId, collectionName);
  const pageSize = options?.batchLimit || BATCH_SIZE;

  let totalFetched = 0;
  let newestTime = since;
  let lastVisibleDoc: DocumentSnapshot | null = null;
  let hasMore = true;

  while (hasMore) {
    let q = query(
      collection(firestore, collectionName),
      where('companyId', '==', tenantId),
      where('updatedAt', '>', since),
      orderBy('updatedAt', 'asc'),
      limit(pageSize)
    );

    if (lastVisibleDoc) {
      q = query(
        collection(firestore, collectionName),
        where('companyId', '==', tenantId),
        where('updatedAt', '>', since),
        orderBy('updatedAt', 'asc'),
        startAfter(lastVisibleDoc),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      break;
    }

    const records: T[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as T & { updatedAt?: string };
      records.push({ ...data, id: docSnap.id });
      if (data.updatedAt && data.updatedAt > newestTime) {
        newestTime = data.updatedAt;
      }
    });

    totalFetched += records.length;
    if (options?.onBatch) {
      await options.onBatch(records);
    }

    lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < pageSize) {
      hasMore = false;
    }
  }

  if (newestTime > since) {
    setLastSyncTimestamp(tenantId, collectionName, newestTime);
  }

  return {
    count: totalFetched,
    newestUpdatedAt: newestTime,
  };
}
