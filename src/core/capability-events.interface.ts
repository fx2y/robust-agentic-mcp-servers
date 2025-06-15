export type CapabilityEvent = {
  type: 'capability.updated' | 'capability.deleted';
  id: string;
  capabilityType: 'tool' | 'plan';
};

export interface ICapabilityEventEmitter {
  emit(event: CapabilityEvent): Promise<void>;
}

export interface ICapabilityEventListener {
  on(eventType: CapabilityEvent['type'], handler: (id: string, type: 'tool' | 'plan') => void): void;
  startListening(): void;
}