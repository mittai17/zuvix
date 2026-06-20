/* src/store/skillStore.ts */

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  source: 'ClawHub' | 'Hermes-Learned' | 'System';
  status: 'installed' | 'available';
  code: string;
  readme: string;
  dependencies: string[];
}

export const INITIAL_SKILLS: Skill[] = [
  {
    id: 'web-browser',
    name: 'Browser Automation',
    description: 'Automates browser clicks, page navigation, and DOM selector extractions.',
    version: '1.2.0',
    source: 'System',
    status: 'installed',
    code: `export async function execute(url: string, selector: string) {\n  console.log("Navigating to " + url);\n  const page = await browser.newPage();\n  await page.goto(url);\n  const content = await page.$eval(selector, el => el.textContent);\n  return { success: true, text: content };\n}`,
    readme: `# Browser Automation\nAllows the agent to scrape dynamic SPA websites and perform actions.`,
    dependencies: ['puppeteer-core', 'chrome-launcher']
  },
  {
    id: 'notion-mcp',
    name: 'Notion Connector',
    description: 'Model Context Protocol tool mapping databases and pages into agent workspace.',
    version: '2.0.4',
    source: 'ClawHub',
    status: 'installed',
    code: `export async function execute(action: 'read' | 'write', blockId: string, content?: any) {\n  const notion = new NotionClient({ auth: process.env.NOTION_TOKEN });\n  if (action === 'read') {\n    return await notion.blocks.retrieve({ block_id: blockId });\n  } else {\n    return await notion.blocks.children.append({ block_id: blockId, children: [content] });\n  }\n}`,
    readme: `# Notion MCP\nExposes Notion workspace search, table reading, and document generation to AI agents.`,
    dependencies: ['@notionhq/client']
  },
  {
    id: 'code-interpreter',
    name: 'Python Sandbox Interpreter',
    description: 'Runs dynamic Python files in a secure container for analytics and plots.',
    version: '1.5.0',
    source: 'System',
    status: 'installed',
    code: `export async function execute(code: string) {\n  const container = await docker.createContainer('python:3.11-slim');\n  await container.start();\n  const result = await container.runCode(code);\n  return result;\n}`,
    readme: `# Python Code Interpreter\nExecutes mathematics, machine learning, data cleaning, and graph generation inside a sandbox.`,
    dependencies: ['dockerode']
  },
  // ClawHub Available Skills
  {
    id: 'gmail-agent',
    name: 'Gmail Automator',
    description: 'Drafts responses, filters spam, and schedules emails based on inbox importance.',
    version: '0.9.1',
    source: 'ClawHub',
    status: 'available',
    code: `export async function execute(action: 'send' | 'draft', to: string, subject: string, body: string) {\n  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });\n  // Code to send or draft mail...\n  return { messageId: 'msg_192837' };\n}`,
    readme: `# Gmail Automator\nEnables reading, drafting, and filtering emails autonomously.`,
    dependencies: ['googleapis']
  },
  {
    id: 'discord-logger',
    name: 'Discord Event Webhook',
    description: 'Logs agent achievements, errors, and schedules directly to server channels.',
    version: '1.0.3',
    source: 'ClawHub',
    status: 'available',
    code: `export async function execute(webhookUrl: string, payload: any) {\n  const res = await fetch(webhookUrl, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify(payload)\n  });\n  return { ok: res.ok };\n}`,
    readme: `# Discord Webhook Logger\nStreams agent activity updates directly to Discord.`,
    dependencies: []
  },
  {
    id: 'sqlite-vector-db',
    name: 'SQLite Vector Store',
    description: 'Vector-similarity search module using sqlite-vss extension for light local RAG.',
    version: '1.1.0',
    source: 'ClawHub',
    status: 'available',
    code: `export async function execute(queryVector: number[], limit: number = 5) {\n  const db = new Database('vector_memory.db');\n  const matches = db.prepare('SELECT rowid, distance FROM vss_memory WHERE vss_search(vector, ?) LIMIT ?').all(JSON.stringify(queryVector), limit);\n  return matches;\n}`,
    readme: `# SQLite Vector Store\nAdds local-first vector search support to store memory directly on disk.`,
    dependencies: ['better-sqlite3']
  }
];

// Hermes Self-improving simulator steps
export interface LearningRunStep {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  log: string;
}

export const SELF_LEARNING_STEPS: LearningRunStep[] = [
  { label: 'Analyze Task & Error Logs', status: 'pending', log: 'Waiting for task input...' },
  { label: 'Formulate Code Solution', status: 'pending', log: 'Synthesizing JavaScript / TypeScript skill rules...' },
  { label: 'Run Local Verification Sandbox', status: 'pending', log: 'Executing unit tests inside sandbox...' },
  { label: 'Refine & Package Skill', status: 'pending', log: 'Writing package.json and SKILL.md definition...' },
  { label: 'Persist & Sync to DB', status: 'pending', log: 'Registering tool in memory store and Supabase cloud...' }
];
