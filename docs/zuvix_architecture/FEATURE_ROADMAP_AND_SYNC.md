# Zuvix OS - Architecture & Future Roadmap

This document outlines the architectural improvements, web-sync capabilities, and the "Always On" features integrated into Zuvix OS.

## 1. Web-to-Device Sync Architecture (Personal Node)
Zuvix OS allows the user to access their complete suite of agent tools via the Web, without hosting a costly cloud backend. 
- **The Engine:** The user's physical laptop/desktop acts as the server ("Personal Node").
- **The Relay:** Supabase Realtime Channels are used to pass messages securely between the Web UI and the Laptop Node.
- **Data Flow:** Web Request -> Supabase Channel -> Local Background Process -> MCP/Task Execution -> Supabase Channel -> Web Response.

## 2. "Hey Zuvix" - Always On System
- The desktop application runs a background process listener.
- Upon detecting the wake word "Hey Zuvix", the system brings the Zuvix UI to the foreground.
- The UI triggers the `SiriFace` (Water Drop Blob) component to transition into an `engaged` or `listening` state.

## 3. UI Aesthetics (Claymorphism + Glassmorphism)
- The entire application avoids flat design.
- **Glassmorphism:** Achieved via `backdrop-filter: blur(20px)` and transparent RGBA backgrounds.
- **Claymorphism:** Achieved via double inner/outer soft box-shadows.
- **The Blob:** The central interactive agent face uses SVG `feGaussianBlur` and `feColorMatrix` to create liquid surface tension, simulating a real drop of water on glass.

## 4. Setup Scripts
Automated initialization scripts are located in `/scripts` to allow the user to immediately configure their physical devices to act as silent background nodes.
