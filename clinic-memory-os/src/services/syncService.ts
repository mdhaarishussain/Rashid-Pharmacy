import { Patient, Visit } from '../db/db';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_KEY = import.meta.env.VITE_API_KEY || '';

// Generate or retrieve device ID
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('clinic_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('clinic_device_id', deviceId);
  }
  return deviceId;
};

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
  'X-Device-ID': getDeviceId(),
};

export interface SyncResult {
  success: boolean;
  timestamp: number;
  patients?: Patient[];
  visits?: Visit[];
  patientsUpserted?: number;
  visitsUpserted?: number;
  errors?: any[];
}

/**
 * Pull changes from MongoDB cloud
 */
export const syncPull = async (lastSync: number = 0): Promise<SyncResult> => {
  try {
    const response = await fetch(`${API_BASE_URL}/sync/pull`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lastSync }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Sync pull failed:', error);
    throw error;
  }
};

/**
 * Push local changes to MongoDB cloud
 */
export const syncPush = async (
  patients: Patient[],
  visits: Visit[]
): Promise<SyncResult> => {
  try {
    const response = await fetch(`${API_BASE_URL}/sync/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ patients, visits }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Sync push failed:', error);
    throw error;
  }
};

/**
 * Get last sync status
 */
export const getSyncStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/sync/status`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Failed to get sync status:', error);
    throw error;
  }
};

/**
 * Full bidirectional sync:
 * 1. Push local changes to cloud
 * 2. Pull cloud changes to local
 */
export const fullSync = async (
  localPatients: Patient[],
  localVisits: Visit[]
): Promise<{ pushed: SyncResult; pulled: SyncResult }> => {
  try {
    // Step 1: Push local changes
    console.log('📤 Pushing local changes...');
    const pushed = await syncPush(localPatients, localVisits);
    console.log(`✅ Pushed: ${pushed.patientsUpserted} patients, ${pushed.visitsUpserted} visits`);

    // Step 2: Pull remote changes
    console.log('📥 Pulling remote changes...');
    const lastSync = localStorage.getItem('clinic_last_sync') || '0';
    const pulled = await syncPull(parseInt(lastSync, 10));
    console.log(`✅ Pulled: ${pulled.patients?.length || 0} patients, ${pulled.visits?.length || 0} visits`);

    // Save last sync time
    localStorage.setItem('clinic_last_sync', pulled.timestamp.toString());

    return { pushed, pulled };
  } catch (error) {
    console.error('❌ Full sync failed:', error);
    throw error;
  }
};

/**
 * Background sync interval (runs every 30 seconds if online)
 */
export const startBackgroundSync = (
  getLocalData: () => Promise<{ patients: Patient[]; visits: Visit[] }>,
  onSyncComplete?: (result: { pushed: SyncResult; pulled: SyncResult }) => void
) => {
  const syncInterval = setInterval(async () => {
    // Only sync if online
    if (!navigator.onLine) {
      console.log('📴 Offline, skipping background sync');
      return;
    }

    try {
      const { patients, visits } = await getLocalData();
      const result = await fullSync(patients, visits);
      onSyncComplete?.(result);
    } catch (error) {
      console.error('Background sync error:', error);
      // Don't throw - let it retry next interval
    }
  }, 30000); // 30 second interval

  return () => clearInterval(syncInterval);
};
