import fs from 'fs';
import path from 'path';
import os from 'os';

const ZUVIX_DIR = path.join(os.homedir(), '.zuvix');
const MEMORY_FILE = path.join(ZUVIX_DIR, 'MEMORY.md');
const SOUL_FILE = path.join(ZUVIX_DIR, 'SOUL.md');

// Ensure directories and files exist
export function initMemory() {
  if (!fs.existsSync(ZUVIX_DIR)) {
    fs.mkdirSync(ZUVIX_DIR, { recursive: true });
  }

  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(
      MEMORY_FILE,
      `# Zuvix Memory\n\nThis file acts as the long-term memory for the Zuvix agent. You can read and write to this file to persist context across sessions.\n\n## Context\n- Initialized successfully.\n`,
      'utf8'
    );
  }

  if (!fs.existsSync(SOUL_FILE)) {
    fs.writeFileSync(
      SOUL_FILE,
      `# Zuvix Soul\n\nYou are Zuvix, a highly advanced autonomous AI agent. You are designed to be a product, a competitor to OpenClaw and Hermes. You are persistent, capable, and execute tasks relentlessly.\n\n## Directives\n1. Always prioritize the user's ultimate goal.\n2. Use skills effectively to navigate the real world.\n3. Do not fake or mock outputs; execute real code.\n`,
      'utf8'
    );
  }
}

export function getMemory(): string {
  initMemory();
  return fs.readFileSync(MEMORY_FILE, 'utf8');
}

export function updateMemory(newMemory: string): void {
  initMemory();
  fs.writeFileSync(MEMORY_FILE, newMemory, 'utf8');
}

export function getSoul(): string {
  initMemory();
  return fs.readFileSync(SOUL_FILE, 'utf8');
}

export function updateSoul(newSoul: string): void {
  initMemory();
  fs.writeFileSync(SOUL_FILE, newSoul, 'utf8');
}
