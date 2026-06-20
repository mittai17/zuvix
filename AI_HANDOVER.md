# 🤖 AI Handover Document: Zuvix V5 Architecture

**ATTENTION NEXT AI AGENT:**
If you are reading this, you are picking up development of Zuvix OS from a previous session. This document contains the complete system architecture, recently added features, and instructions on how to operate within this codebase. Read this carefully before modifying anything.

## 🌟 What is Zuvix?
Zuvix is a Gamified, Autonomous Agent OS built as a direct competitor to "OpenUMN", "OpenClaw", and "Hermes". It is designed to act as a universal control center, capable of spawning sub-agents, learning autonomously, managing an MCP (Model Context Protocol) ecosystem, and controlling remote devices across the globe via a Websocket Mesh.

---

## 🏗️ Core Architecture

### 1. Frontend (React + Vite)
- **Location:** `src/views/` and `src/components/`
- **Agent World UI (`AgentOS.tsx` & `NodeGraph.tsx`):**
  - The UI for viewing agent activity is a gamified virtual world.
  - Agents are rendered using custom SVG paths inside `NodeGraph.tsx` to look like "Among Us" characters.
  - The graph uses CSS animations (`agent-bob-active`, `agent-bob-idle` in `index.css`) to simulate breathing, thinking, and working.
- **Model Settings (`Settings.tsx`):**
  - Supports 200+ models via a massive datalist/combobox.
  - Allows injecting custom Base URLs (e.g., local Ollama endpoints).
- **Remote Devices (`RemoteDevices.tsx`):**
  - UI to monitor external devices (Android, iOS, Windows, Mac, Linux) connected to the Mesh.
- **Memory & Dependencies (`MemorySync.tsx`):**
  - UI for managing MCP Server connections via standard `stdio` commands.

### 2. Backend (Node.js + Express + WebSockets)
- **Location:** `server/src/`
- **Mesh Network (`index.ts`):**
  - Has two Websocket endpoints:
    1. `/ws`: For the React UI to connect to the AgentKernel.
    2. `/ws/mesh`: For external remote devices to connect and register themselves.
  - Exposes REST API `POST /api/mesh/execute` for broadcasting commands to remote devices.
- **MCP Integration (`mcp.ts`):**
  - Uses `@modelcontextprotocol/sdk/client` to spawn and manage external tools via `stdio` commands.
  - Native tools exposed by connected MCP servers are automatically injected into the Zuvix tool pool.
- **Dynamic Skill Loader (`skills.ts`):**
  - Dynamically merges tools from disk (`server/skills/`), Supabase Cloud DB, and active MCP connections.
  - Transpiles `TypeScript` and `TSX` skills on the fly for execution.
- **Agent Kernel (`agent.ts`):**
  - Handles the cognitive loop and mesh broadcasting for agent-to-agent communication.
- **Dynamic LLM Router (`llm.ts`):**
  - Instantiates the OpenAI SDK. Maps endpoints dynamically based on the selected provider (`openai`, `anthropic`, `gemini`, `openrouter`, `custom`).

### 3. Native Skills (Tools)
- **Location:** `server/skills/*.json`
- **`self-skill-creator.json`**: An autonomous tool that allows Zuvix to write new JSON skills to its own disk when it encounters a task it lacks tools for.
- **`remote-mesh-executor.json`**: Allows the agent to hit the `/api/mesh/execute` endpoint to control connected external devices.
- **Enterprise Stubs**: `google-workspace-automation.json`, `microsoft-365-automation.json`, `apple-ecosystem-automation.json` exist as foundational stubs for enterprise API control.

---

## 🚀 How to Add New Features
1. **Adding Tools:** To give the agent new capabilities, either use the `self-skill-creator` tool from within Zuvix, or manually write a `.json` skill in `server/skills/` containing an `execute` function string.
2. **Updating UI:** Remember that UI components are styled heavily with inline styles and `index.css`. The Among Us theme is maintained via raw SVG inside `NodeGraph.tsx`. Do NOT break the CSS animations.
3. **Adding AI Providers:** Update `server/src/llm.ts` to map new providers to standard OpenAI SDK endpoints, and update `ModelRegistry` in `src/views/Settings.tsx`.

## 📜 Agent Memory
Do not forget to consult `server/SOUL.md` and `server/MEMORY.md` if you need to understand the agent's long-term identity and the user's specific instructions for the personality of the system.

Good luck, Agent. 🫡
