# Zuvix Technical Architecture

This document provides a detailed overview of the system architecture of Zuvix: a cross-platform client and simulator integrating OpenClaw and Nous Research's Hermes Agent features.

## System Components

### 1. Agent OS (Kernel)
The execution coordinator in Zuvix is modeled after OpenClaw's orchestration layer. When a task is initiated:
1. **Planner Agent:** Formulates a set of sequential steps to solve the goal.
2. **Subagents:** The Kernel spawns worker threads (e.g., Coder, Web Researcher, QA Verifier) to fulfill individual steps.
3. **Log Stream:** Communications are aggregated into a central database log model.

### 2. UI Theme Engine (Glass, Neo, Clay)
To deliver a high-quality frontend experience, Zuvix features a switchable UI layout supporting:
- **Glassmorphism:** Uses `backdrop-filter` blur, thin light-reflecting semi-transparent borders, and neon box-shadows.
- **Neomorphism:** Relies on smooth extruded colors (`box-shadow` values using lighter/darker shades of the card color) to make elements blend into their background.
- **Claymorphism:** Incorporates rounded borders and inner inset shadows to create a plump 3D effect.
- **Hybrid:** Combines all three styles—frosted glass panels, neomorphic input elements, and claymorphic call-to-action buttons.

### 3. Database Sync Layer (Supabase + IndexedDB)
Zuvix uses a local-first replication pattern:
- **Local Database:** Powered by IndexedDB. It stores active sessions, tool registry definitions, and memory indices locally.
- **Supabase Cloud Sync:** When credentials are provided, local IndexedDB changes sync using conflict-free Merged set rules (CRDTs) to a remote Supabase Postgres DB, maintaining state consistency across mobile and desktop.

```
                  +-------------------------+
                  |     Zuvix Client UI     |
                  +-------------------------+
                               |
                               v
                  +-------------------------+
                  |    Agent OS Kernel      |
                  +-------------------------+
                   /           |           \
                  v            v            v
           +-----------+ +-----------+ +-----------+
           | Planner   | | Coder     | | QA Test   |
           +-----------+ +-----------+ +-----------+
                  \            |            /
                   v           v           v
                  +-------------------------+
                  |    WebMCP / Tool Runner |
                  +-------------------------+
                               |
                               v
                  +-------------------------+
                  |  Local DB (IndexedDB)   |
                  +-------------------------+
                               | (Realtime Sync)
                               v
                  +-------------------------+
                  |    Supabase Cloud DB    |
                  +-------------------------+
```
