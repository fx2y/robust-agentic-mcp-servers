import Redis from 'ioredis';
import { ICentralCapabilityStore } from './central-capability-store.interface';
import { ToolDefinition } from './tool-definition';
import { AgenticPlan } from './agentic-plan/plan-executor';

export class RedisCentralCapabilityStore implements ICentralCapabilityStore {
  private static readonly CAPABILITY_KEY_PREFIX = 'capability:';
  private static readonly CAPABILITY_LIST_KEY = 'capabilities:all';

  constructor(private redis: Redis) {}

  async save(id: string, type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan): Promise<void> {
    const key = this.getCapabilityKey(id);
    const data = JSON.stringify({ type, definition });
    
    await Promise.all([
      this.redis.set(key, data),
      this.redis.sadd(RedisCentralCapabilityStore.CAPABILITY_LIST_KEY, id)
    ]);
  }

  async get(id: string): Promise<{ type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan } | null> {
    const key = this.getCapabilityKey(id);
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to parse capability data for ${id}: ${error}`);
    }
  }

  async listAll(): Promise<Array<{ id: string, type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan }>> {
    const ids = await this.redis.smembers(RedisCentralCapabilityStore.CAPABILITY_LIST_KEY);
    const capabilities: Array<{ id: string, type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan }> = [];

    for (const id of ids) {
      const capability = await this.get(id);
      if (capability) {
        capabilities.push({ id, ...capability });
      }
    }

    return capabilities;
  }

  async delete(id: string): Promise<boolean> {
    const key = this.getCapabilityKey(id);
    
    const [delResult, sremResult] = await Promise.all([
      this.redis.del(key),
      this.redis.srem(RedisCentralCapabilityStore.CAPABILITY_LIST_KEY, id)
    ]);
    
    return delResult > 0 || sremResult > 0;
  }

  private getCapabilityKey(id: string): string {
    return `${RedisCentralCapabilityStore.CAPABILITY_KEY_PREFIX}${id}`;
  }
}