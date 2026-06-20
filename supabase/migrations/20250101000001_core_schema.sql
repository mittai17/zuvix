-- Migration 001: Core Zuvix Schema
-- Creates all tables needed by Zuvix OS

-- Agent memory/vector store
CREATE TABLE IF NOT EXISTS agent_memory (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON agent_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_created ON agent_memory(created_at DESC);

-- Agent telemetry logs
CREATE TABLE IF NOT EXISTS zuvix_logs (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT,
  action_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_agent ON zuvix_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON zuvix_logs(created_at DESC);

-- Cloud tool registry (skill store)
CREATE TABLE IF NOT EXISTS zuvix_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  code TEXT DEFAULT '',
  readme TEXT DEFAULT '',
  dependencies JSONB DEFAULT '[]',
  last_modified TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions (for sync system)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified TIMESTAMPTZ DEFAULT NOW(),
  logs JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_chat_modified ON chat_sessions(last_modified DESC);

-- Dependencies registry
CREATE TABLE IF NOT EXISTS dependencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'mcp',
  status TEXT DEFAULT 'active',
  cloud_url TEXT DEFAULT '',
  last_modified TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional, for multi-tenant)
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE zuvix_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zuvix_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependencies ENABLE ROW LEVEL SECURITY;
