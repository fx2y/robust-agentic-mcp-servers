import { ICapabilityEventEmitter, ICapabilityEventListener, CapabilityEvent } from './capability-events.interface';

export class InMemoryCapabilityEventBus implements ICapabilityEventEmitter, ICapabilityEventListener {
  private listeners = new Map<string, Set<(id: string, type: 'tool' | 'plan') => void>>();

  async emit(event: CapabilityEvent): Promise<void> {
    const eventListeners = this.listeners.get(event.type);
    if (eventListeners) {
      Array.from(eventListeners).forEach(listener => listener(event.id, event.capabilityType));
    }
  }

  on(eventType: CapabilityEvent['type'], handler: (id: string, type: 'tool' | 'plan') => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
  }

  onCapabilityChanged(callback: () => Promise<void>): void {
    // Legacy method - convert to new interface
    this.on('capability.updated', () => callback());
  }

  startListening(): void {
    // No-op for in-memory implementation
  }

  async disconnect(): Promise<void> {
    this.listeners.clear();
  }
}