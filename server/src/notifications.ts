interface Notification {
  id: string;
  type: 'desktop' | 'email' | 'webhook' | 'sms';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  source?: string;
  metadata?: Record<string, any>;
  createdAt: number;
  delivered: boolean;
  read: boolean;
}

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

interface WebhookConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
}

class Notifications {
  private history: Notification[] = [];
  private subscribers: Set<(n: Notification) => void> = new Set();
  private emailConfig: EmailConfig | null = null;
  private webhooks: WebhookConfig[] = [];

  setEmailConfig(config: EmailConfig) {
    this.emailConfig = config;
  }

  addWebhook(config: WebhookConfig) {
    this.webhooks.push(config);
  }

  removeWebhook(url: string) {
    this.webhooks = this.webhooks.filter(w => w.url !== url);
  }

  subscribe(fn: (n: Notification) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  async send(
    type: Notification['type'],
    title: string,
    message: string,
    options: { priority?: Notification['priority']; source?: string; metadata?: Record<string, any> } = {}
  ): Promise<Notification> {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      message,
      priority: options.priority || 'normal',
      source: options.source,
      metadata: options.metadata,
      createdAt: Date.now(),
      delivered: false,
      read: false,
    };

    this.history.push(notification);
    if (this.history.length > 500) this.history = this.history.slice(-500);

    try {
      switch (type) {
        case 'email':
          await this.deliverEmail(notification);
          break;
        case 'webhook':
          await this.deliverWebhook(notification);
          break;
        case 'desktop':
          this.deliverDesktop(notification);
          break;
      }
      notification.delivered = true;
    } catch (err: any) {
      console.error(`[Notifications] Failed to deliver ${type}:`, err.message);
    }

    return notification;
  }

  private async deliverEmail(notification: Notification) {
    if (!this.emailConfig) return;
    // Use nodemailer if available, otherwise log
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: this.emailConfig.host,
        port: this.emailConfig.port,
        secure: this.emailConfig.port === 465,
        auth: { user: this.emailConfig.user, pass: this.emailConfig.pass },
      });
      await transporter.sendMail({
        from: this.emailConfig.from || 'zuvix@localhost',
        to: notification.metadata?.to || '',
        subject: `[Zuvix] ${notification.title}`,
        text: notification.message,
        html: `<div style="font-family:sans-serif;padding:20px;max-width:600px">
          <h2 style="color:#3b82f6">${notification.title}</h2>
          <p>${notification.message}</p>
          <hr style="border:none;border-top:1px solid #eee"/>
          <p style="color:#888;font-size:12px">Sent by Zuvix Notification System</p>
        </div>`,
      });
    } catch (err) {
      console.error('[Notifications] Email delivery failed (nodemailer may not be installed):', err);
    }
  }

  private async deliverWebhook(notification: Notification) {
    for (const wh of this.webhooks) {
      try {
        await fetch(wh.url, {
          method: wh.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...wh.headers,
          },
          body: JSON.stringify({
            event: 'notification',
            id: notification.id,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            source: notification.source,
            timestamp: notification.createdAt,
          }),
        });
      } catch (err) {
        console.error(`[Notifications] Webhook ${wh.url} failed:`, err);
      }
    }
  }

  private deliverDesktop(notification: Notification) {
    for (const sub of this.subscribers) {
      try { sub(notification); } catch { /* ignore */ }
    }
  }

  pushToWebSocket(wss: any) {
    this.subscribe((notification) => {
      const msg = JSON.stringify({
        type: 'notification',
        payload: notification,
      });
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(msg);
        }
      });
    });
  }

  getHistory(limit = 50): Notification[] {
    return this.history.slice(-limit).reverse();
  }

  markRead(id: string) {
    const n = this.history.find(n => n.id === id);
    if (n) n.read = true;
  }

  markAllRead() {
    this.history.forEach(n => n.read = true);
  }

  getUnreadCount(): number {
    return this.history.filter(n => !n.read).length;
  }
}

export const notifications = new Notifications();
