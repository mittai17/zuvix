# Hermes Self-Improving Learning Loop

This document outlines the self-learning capability integrated within the Zuvix agent platform.

## Self-Improvement Workflow

Unlike standard agents that fail on unsupported API calls or missing dependencies, the Hermes engine interceptor attempts to build the necessary tool autonomously:

```
[ User Task ] ---> ( Execute Steps ) ---> ( Tool Call Failed )
                                                  |
                                                  v
[ Saved Skill ] <--- ( Tests Pass? ) <--- ( Sandbox Test ) <--- ( Code Synthesis )
```

### 1. Failure Interception & Analysis
When an agent attempts to execute a task requiring a tool that is not installed or returns an error (e.g. `API endpoint deprecated`), the Kernel routes the raw error stack and task context to the Coordinator Agent.

### 2. Code Synthesis
The Coordinator utilizes its coding capabilities to synthesize a standalone JavaScript/TypeScript module that satisfies the interface. The tool must export a single `execute` function.

### 3. Sandboxed QA Verification
The synthesized code is written to a virtual file and run within a mock sandbox:
- A syntax linter checks for imports and references.
- Custom assertions verify that the inputs match the expected schema and that the output returns correctly.

### 4. Skill Formatting
If validation passes, the tool is packaged into:
- `execute.ts`: The main source code.
- `SKILL.md`: Markdown instructions describing parameters and target use-cases.

### 5. Local Cache & Cloud Database Sync
The skill is stored in IndexedDB and uploaded to the remote Supabase database. The local runner dynamically imports the tool during subsequent tasks, expanding the agent's capability library.
