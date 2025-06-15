import Redis from 'ioredis';
import { CapabilityEvent, ICapabilityEventEmitter, ICapabilityEventListener } from './capability-events.interface';

export class RedisCapabilityEventBus implements ICapabilityEventEmitter, ICapabilityEventListener {
  private static readonly CHANNEL_NAME = 'capability-events';
  private handlers: Map<CapabilityEvent['type'], ((id: string, type: 'tool' | 'plan') => void)[]> = new Map();
  private subscriber?: Redis;

  constructor(private redis: Redis) {}

  async emit(event: CapabilityEvent): Promise<void> {
    const message = JSON.stringify(event);
    await this.redis.publish(RedisCapabilityEventBus.CHANNEL_NAME, message);
  }

  on(eventType: CapabilityEvent['type'], handler: (id: string, type: 'tool' | 'plan') => void): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  startListening(): void {
    if (this.subscriber) {
      return;
    }

    this.subscriber = new Redis(this.redis.options);
    this.subscriber.subscribe(RedisCapabilityEventBus.CHANNEL_NAME);

    this.subscriber.on('message', (channel, message) => {
      if (channel === RedisCapabilityEventBus.CHANNEL_NAME) {
        try {
          const event: CapabilityEvent = JSON.parse(message);
          const handlers = this.handlers.get(event.type);
          
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(event.id, event.capabilityType);
              } catch (error) {
                console.error('Error handling capability event:', error);
              }
            });
          }
        } catch (error) {
          console.error('Error parsing capability event message:', error);
        }
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.disconnect();
      this.subscriber = undefined;
    }
  }
}