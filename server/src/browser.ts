import { chromium, Browser, Page } from 'playwright';

interface BrowserCommand {
  action: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'evaluate' | 'wait' | 'scroll' | 'snapshot';
  target?: string;       // CSS selector
  value?: string;        // text to type, URL, etc.
  timeout?: number;       // ms
}

interface BrowserResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;  // base64 PNG
  url?: string;
  title?: string;
}

class AgentBrowser {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private currentUrl: string = 'about:blank';

  async launch(headless: boolean = true): Promise<void> {
    if (this.browser) return;
    this.browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zuvix/1.0',
    });
    this.page = await context.newPage();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async execute(command: BrowserCommand): Promise<BrowserResult> {
    if (!this.page) await this.launch();

    try {
      switch (command.action) {
        case 'navigate': {
          const url = command.value || 'about:blank';
          await this.page!.goto(url, { waitUntil: 'networkidle', timeout: command.timeout || 30000 });
          this.currentUrl = this.page!.url();
          return {
            success: true,
            data: { url: this.currentUrl, title: await this.page!.title() },
            url: this.currentUrl,
            title: await this.page!.title(),
          };
        }

        case 'click': {
          if (!command.target) return { success: false, error: 'No CSS selector provided' };
          await this.page!.waitForSelector(command.target, { timeout: command.timeout || 5000 });
          await this.page!.click(command.target);
          return { success: true, data: `Clicked ${command.target}`, url: this.page!.url() };
        }

        case 'type': {
          if (!command.target) return { success: false, error: 'No CSS selector provided' };
          await this.page!.waitForSelector(command.target, { timeout: command.timeout || 5000 });
          await this.page!.fill(command.target, command.value || '');
          return { success: true, data: `Typed into ${command.target}`, url: this.page!.url() };
        }

        case 'screenshot': {
          const buf = await this.page!.screenshot({ type: 'png', fullPage: true });
          return {
            success: true,
            screenshot: buf.toString('base64'),
            url: this.page!.url(),
            title: await this.page!.title(),
          };
        }

        case 'extract': {
          const text = command.target
            ? await this.page!.textContent(command.target)
            : await this.page!.evaluate(`document.body.innerText`);
          return {
            success: true,
            data: (text as string)?.substring(0, 10000),
            url: this.page!.url(),
            title: await this.page!.title(),
          };
        }

        case 'snapshot': {
          const snapshot = await this.page!.evaluate(`(function() {
            function getAccessibleTree(el, depth) {
              if (depth > 5) return null;
              var tag = (el.tagName || '').toLowerCase();
              if (['script','style','noscript','link','meta'].indexOf(tag) >= 0) return null;
              var role = el.getAttribute('role') || '';
              var label = el.getAttribute('aria-label') || '';
              var text = (el.innerText || '').substring(0, 80);
              var children = Array.from(el.children).map(function(c) { return getAccessibleTree(c, (depth || 0) + 1); }).filter(Boolean);
              if (!children.length && !text && !label) return null;
              return { tag: tag, role: role, label: label, text: text, children: children.length ? children : undefined };
            }
            return getAccessibleTree(document.body, 0);
          })()`);
          return {
            success: true,
            data: snapshot,
            url: this.page!.url(),
            title: await this.page!.title(),
          };
        }

        case 'evaluate': {
          const result = await this.page!.evaluate(command.value || '');
          return { success: true, data: result, url: this.page!.url() };
        }

        case 'wait': {
          const ms = parseInt(command.value || '1000');
          await this.page!.waitForTimeout(ms);
          return { success: true, data: `Waited ${ms}ms`, url: this.page!.url() };
        }

        case 'scroll': {
          await this.page!.evaluate(`window.scrollBy({ top: ${parseInt(command.value || '500')}, behavior: 'smooth' })`);
          return { success: true, data: 'Scrolled', url: this.page!.url() };
        }

        default:
          return { success: false, error: `Unknown action: ${(command as any).action}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message, url: this.page?.url() };
    }
  }

  getStatus() {
    return {
      running: this.browser !== null,
      url: this.currentUrl,
      pageOpen: this.page !== null,
    };
  }
}

export const agentBrowser = new AgentBrowser();
