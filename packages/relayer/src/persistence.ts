import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const FUNDED_FILE = path.join(config.dataDir, 'funded-addresses.json');
const SESSIONS_FILE = path.join(config.dataDir, 'fulfilled-sessions.json');

function ensureDataDir(): void {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

export function loadFundedAddresses(): Set<string> {
  ensureDataDir();
  try {
    if (fs.existsSync(FUNDED_FILE)) {
      const data = JSON.parse(fs.readFileSync(FUNDED_FILE, 'utf-8'));
      return new Set(data);
    }
  } catch (err) {
    console.error('[persistence] Failed to load funded addresses:', err);
  }
  return new Set();
}

export function saveFundedAddresses(addresses: Set<string>): void {
  ensureDataDir();
  try {
    fs.writeFileSync(FUNDED_FILE, JSON.stringify([...addresses]), 'utf-8');
  } catch (err) {
    console.error('[persistence] Failed to save funded addresses:', err);
  }
}

export function loadFulfilledSessions(): Set<string> {
  ensureDataDir();
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      return new Set(data);
    }
  } catch (err) {
    console.error('[persistence] Failed to load fulfilled sessions:', err);
  }
  return new Set();
}

export function saveFulfilledSessions(sessions: Set<string>): void {
  ensureDataDir();
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([...sessions]), 'utf-8');
  } catch (err) {
    console.error('[persistence] Failed to save fulfilled sessions:', err);
  }
}
