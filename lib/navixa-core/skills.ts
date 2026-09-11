import type { SkillDefinition } from "./types.ts";

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): this {
    const id = skill.id.trim();
    if (!id) throw new Error("Skill id is required");
    if (this.skills.has(id)) throw new Error(`Skill already registered: ${id}`);

    this.skills.set(id, { ...skill, id });
    return this;
  }

  registerMany(skills: readonly SkillDefinition[]): this {
    for (const skill of skills) this.register(skill);
    return this;
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  list(): SkillDefinition[] {
    return [...this.skills.values()];
  }
}
