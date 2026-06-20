import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VAULT_FILE = path.resolve(process.cwd(), 'server/data/vault.enc');

// We need a 32-byte key for AES-256-GCM. 
// If VAULT_MASTER_KEY is set but not 32 bytes, we hash it to get exactly 32 bytes.
const rawKey = process.env.VAULT_MASTER_KEY || 'Zuvix_Default_Unsafe_Vault_Key_123!';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(rawKey).digest(); 
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const ensureDataDir = () => {
    const dir = path.dirname(VAULT_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const loadVault = (): Record<string, string> => {
    ensureDataDir();
    if (!fs.existsSync(VAULT_FILE)) {
        return {};
    }
    try {
        const encryptedData = fs.readFileSync(VAULT_FILE, 'utf8');
        if (!encryptedData.trim()) return {};
        
        // Decrypt the entire vault string
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = Buffer.from(parts[2], 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    } catch (e) {
        console.error('[Vault] Error decrypting vault:', e);
        return {};
    }
};

const saveVault = (vaultData: Record<string, string>) => {
    ensureDataDir();
    try {
        const text = JSON.stringify(vaultData);
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        
        let encrypted = cipher.update(text, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();
        
        const output = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
        fs.writeFileSync(VAULT_FILE, output, 'utf8');
    } catch (e) {
        console.error('[Vault] Error encrypting vault:', e);
    }
};

export const vault = {
    saveSecret: (keyName: string, secretValue: string) => {
        const data = loadVault();
        data[keyName] = secretValue;
        saveVault(data);
    },
    getSecret: (keyName: string): string | null => {
        const data = loadVault();
        return data[keyName] || null;
    },
    listSecretNames: (): string[] => {
        const data = loadVault();
        return Object.keys(data);
    },
    deleteSecret: (keyName: string) => {
        const data = loadVault();
        if (data[keyName]) {
            delete data[keyName];
            saveVault(data);
            return true;
        }
        return false;
    }
};
