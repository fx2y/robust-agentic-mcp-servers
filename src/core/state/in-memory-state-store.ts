import { IStateStore } from './state-store.interface';
import { SessionCore, HistoryEntry } from './types';
import { v4 as uuidv4 } from 'uuid';

export class InMemoryStateStore implements IStateStore {
  private sessions = new Map<string, SessionCore>();
  private histories = new Map<string, HistoryEntry[]>();
  private contexts = new Map<string, Record<string, any>>();
  private blobs = new Map<string, { data: Buffer; contentType: string }>();

  async createSession(core: SessionCore): Promise<void> {
    if (this.sessions.has(core.sessionId)) {
      throw new Error(`Session with ID '${core.sessionId}' already exists`);
    }
    this.sessions.set(core.sessionId, { ...core });
    this.histories.set(core.sessionId, []);
    this.contexts.set(core.sessionId, {});
  }

  async readSessionCore(sessionId: string): Promise<SessionCore | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async updateSessionStatus(
    sessionId: string,
    status: SessionCore['status'],
    error?: any
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }
    
    session.status = status;
    session.updatedAt = new Date().toISOString();
    if (error) {
      session.lastError = {
        name: error.name || 'UnknownError',
        message: error.message || 'An unknown error occurred',
        stack: error.stack
      };
    }
  }

  async appendToHistory(sessionId: string, entry: HistoryEntry): Promise<void> {
    const history = this.histories.get(sessionId);
    if (!history) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }
    history.push({ ...entry });
  }

  async readHistory(sessionId: string, limit?: number): Promise<HistoryEntry[]> {
    const history = this.histories.get(sessionId);
    if (!history) {
      return [];
    }
    
    const entries = history.map(entry => ({ ...entry }));
    return limit ? entries.slice(-limit) : entries;
  }

  async getContext(sessionId: string): Promise<Record<string, any>> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }
    return { ...context };
  }

  async setContext(sessionId: string, context: Record<string, any>): Promise<void> {
    if (!this.contexts.has(sessionId)) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }
    this.contexts.set(sessionId, { ...context });
  }

  async updateContext(sessionId: string, updates: Record<string, any>): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }
    
    Object.assign(context, updates);
  }

  async uploadBlob(data: Buffer, contentType: string): Promise<string> {
    const uri = `blob://${uuidv4()}`;
    this.blobs.set(uri, { data: Buffer.from(data), contentType });
    return uri;
  }

  async downloadBlob(uri: string): Promise<Buffer> {
    const blob = this.blobs.get(uri);
    if (!blob) {
      throw new Error(`Blob with URI '${uri}' not found`);
    }
    return Buffer.from(blob.data);
  }
}