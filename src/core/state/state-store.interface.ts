import { SessionCore, HistoryEntry } from './types';

export interface IStateStore {
  createSession(core: SessionCore): Promise<void>;
  readSessionCore(sessionId: string): Promise<SessionCore | null>;
  updateSessionStatus(sessionId: string, status: SessionCore['status'], error?: any): Promise<void>;
  appendToHistory(sessionId: string, entry: HistoryEntry): Promise<void>;
  readHistory(sessionId: string, limit?: number): Promise<HistoryEntry[]>;
  getContext(sessionId: string): Promise<Record<string, any>>;
  setContext(sessionId: string, context: Record<string, any>): Promise<void>;
  updateContext(sessionId: string, updates: Record<string, any>): Promise<void>; // Atomic partial update
  uploadBlob(data: Buffer, contentType: string): Promise<string>; // Returns URI
  downloadBlob(uri: string): Promise<Buffer>;
}