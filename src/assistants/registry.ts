import { loadAssistantsFromDisk } from './loader.js';
import type { AssistantDefinition } from './types.js';

export class AssistantRegistry {
  private readonly byId = new Map<string, AssistantDefinition>();

  constructor(definitions: AssistantDefinition[]) {
    for (const def of definitions) {
      this.byId.set(def.id, def);
    }
  }

  static async fromDisk(rootDir?: string): Promise<AssistantRegistry> {
    const defs = await loadAssistantsFromDisk(rootDir);
    return new AssistantRegistry(defs);
  }

  list(): AssistantDefinition[] {
    return [...this.byId.values()];
  }

  get(id: string): AssistantDefinition | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /**
   * Returns the assistant whose displayName matches (case-insensitive) or whose
   * id matches. Used by command auto-complete and mention parsing.
   */
  findByName(needle: string): AssistantDefinition | undefined {
    const lc = needle.toLowerCase();
    for (const def of this.byId.values()) {
      if (def.id.toLowerCase() === lc) return def;
      if (def.displayName.toLowerCase() === lc) return def;
    }
    return undefined;
  }
}
