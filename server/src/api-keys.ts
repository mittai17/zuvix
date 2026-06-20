import * as crypto from 'crypto';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  hash: string;
  scopes: string[];
  rateLimit: number;
  createdAt: number;
  lastUsed: number | null;
  revoked: boolean;
  usage: number;
}

interface UsageEntry {
  keyId: string;
  timestamp: number;
  endpoint: string;
  status: number;
}

const KEYS_FILE = process.env.KEYS_FILE || '';
const MAX_USAGE_HISTORY = 10000;

class ApiKeyManager {
  private keys: Map<string, ApiKey> = new Map();
  private usageLog: UsageEntry[] = [];
  private initialized = false;

  constructor() {
    // Seed a default admin key
    this.generateKey('Default Admin', ['admin', 'read', 'write'], 1000);
  }

  generateKey(name: string, scopes: string[] = ['read', 'write'], rateLimit: number = 100): { id: string; key: string; keyData: ApiKey } {
    const id = `key_${crypto.randomBytes(8).toString('hex')}`;
    const token = crypto.randomBytes(24).toString('hex');
    const prefix = 'zvx_' + token.slice(0, 8);
    const fullKey = `${prefix}.${token.slice(8)}`;

    const keyData: ApiKey = {
      id,
      name,
      prefix,
      hash: this.hashKey(fullKey),
      scopes,
      rateLimit,
      createdAt: Date.now(),
      lastUsed: null,
      revoked: false,
      usage: 0,
    };

    this.keys.set(id, keyData);
    return { id, key: fullKey, keyData };
  }

  validateKey(key: string): ApiKey | null {
    const hash = this.hashKey(key);
    for (const [, k] of this.keys) {
      if (k.hash === hash && !k.revoked) {
        k.lastUsed = Date.now();
        k.usage++;
        return k;
      }
    }
    return null;
  }

  revokeKey(id: string): boolean {
    const key = this.keys.get(id);
    if (!key) return false;
    key.revoked = true;
    return true;
  }

  getKeys(): ApiKey[] {
    return Array.from(this.keys.values()).map(k => ({ ...k, hash: '' }));
  }

  getKey(id: string): ApiKey | null {
    const k = this.keys.get(id);
    return k ? { ...k, hash: '' } : null;
  }

  logUsage(keyId: string, endpoint: string, status: number) {
    this.usageLog.push({ keyId, timestamp: Date.now(), endpoint, status });
    if (this.usageLog.length > MAX_USAGE_HISTORY) this.usageLog.shift();
  }

  getUsage(keyId: string, hours: number = 24): { requests: number; errors: number; timeline: { hour: string; count: number }[] } {
    const cutoff = Date.now() - hours * 3600000;
    const entries = this.usageLog.filter(e => e.keyId === keyId && e.timestamp >= cutoff);

    const requests = entries.length;
    const errors = entries.filter(e => e.status >= 400).length;

    // Build hourly timeline
    const buckets = new Map<string, number>();
    for (let i = 0; i < hours; i++) {
      const label = new Date(Date.now() - i * 3600000).toISOString().slice(0, 13);
      buckets.set(label, 0);
    }
    for (const e of entries) {
      const label = new Date(e.timestamp).toISOString().slice(0, 13);
      buckets.set(label, (buckets.get(label) || 0) + 1);
    }

    return {
      requests,
      errors,
      timeline: Array.from(buckets.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
    };
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}

export const apiKeyManager = new ApiKeyManager();
