import { Competency, ICompetency } from '../../models/Competency';
import { UserCompetency, IUserCompetency } from '../../models/UserCompetency';
import { Role, IRole } from '../../models/Role';
import { notFound } from '../../utils/errors';

export const competencyService = {
  async listTaxonomy(category?: string): Promise<ICompetency[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (category) filter.category = category;
    return Competency.find(filter).sort({ category: 1, name: 1 });
  },

  async getByCode(code: string): Promise<ICompetency | null> {
    return Competency.findOne({ code: code.toUpperCase() });
  },

  async getById(id: string): Promise<ICompetency | null> {
    return Competency.findById(id);
  },

  async requireByCode(code: string): Promise<ICompetency> {
    const c = await this.getByCode(code);
    if (!c) throw notFound(`Competency "${code}" not found`);
    return c;
  },

  async listRoles(): Promise<IRole[]> {
    return Role.find({ isActive: true }).populate('requirements.competencyId');
  },

  /** Resolves the role requirement matrix for a user (falls back to defaults). */
  async getRequirementsForUser(userId: string, roleName?: string): Promise<Map<string, { requiredScore: number; competencyId: string; weight: number }>> {
    const map = new Map<string, { requiredScore: number; competencyId: string; weight: number }>();
    const competencies = await Competency.find({ isActive: true });
    const byId = new Map(competencies.map((c) => [String(c._id), c]));
    const byName = new Map(competencies.map((c) => [c.name.toLowerCase(), c]));

    let role: IRole | null = null;
    if (roleName) role = await Role.findOne({ name: roleName, isActive: true });
    if (!role && roleName) {
      // fuzzy: "Statistical Officer" contains / contained in role names
      role = await Role.findOne({ name: new RegExp(roleName.split(' ')[0], 'i'), isActive: true });
    }

    const requirementSource = role?.requirements ?? [];
    // Default requirement map from competency defaults first, then override with role matrix.
    for (const c of competencies) {
      map.set(c.code, { requiredScore: c.defaultRequiredScore, competencyId: String(c._id), weight: 1 });
    }
    for (const req of requirementSource) {
      const c = byId.get(String(req.competencyId));
      if (c) map.set(c.code, { requiredScore: req.requiredScore, competencyId: String(c._id), weight: req.weight ?? 1 });
    }
    void byName;
    void userId;
    return map;
  },

  /** All measured competencies for a user, with taxonomy joined. */
  async getUserCompetencies(userId: string): Promise<(IUserCompetency & { competency?: ICompetency })[]> {
    const docs = await UserCompetency.find({ userId }).sort({ priority: 1, gap: -1 });
    const comps = await Competency.find({});
    const byId = new Map(comps.map((c) => [String(c._id), c]));
    return docs.map((d) => {
      const plain = d.toObject() as IUserCompetency & { competency?: ICompetency };
      plain.competency = byId.get(String(d.competencyId));
      return plain;
    });
  },

  async upsertScore(input: {
    userId: string;
    competencyId: string;
    currentScore: number;
    requiredScore: number;
    confidence?: number;
    source?: string;
    assessedAt?: Date;
  }): Promise<IUserCompetency> {
    return UserCompetency.findOneAndUpdate(
      { userId: input.userId, competencyId: input.competencyId },
      {
        $set: {
          currentScore: Math.max(0, Math.min(100, Math.round(input.currentScore))),
          requiredScore: Math.max(0, Math.min(100, Math.round(input.requiredScore))),
          confidence: input.confidence ?? 0.5,
          source: input.source ?? 'ASSESSMENT',
          lastAssessedAt: input.assessedAt ?? new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },
};
