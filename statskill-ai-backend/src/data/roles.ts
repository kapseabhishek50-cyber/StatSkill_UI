/** Job roles with their competency requirement matrices (prompt §10 — DB-driven, not hardcoded). */
export interface RoleSeed {
  name: string;
  code: string;
  description: string;
  department?: string;
  /** competencyCode → requiredScore */
  requirements: Record<string, number>;
  weights?: Record<string, number>; // importance weight 0-1 (role matching)
}

export const ROLE_SEED: RoleSeed[] = [
  {
    name: 'Statistical Officer',
    code: 'STATISTICAL_OFFICER',
    description: 'Designs, collects and analyses official statistics in a statistical division.',
    requirements: {
      SURVEY_DESIGN: 75,
      SAMPLING: 75,
      DATA_QUALITY: 70,
      NATIONAL_ACCOUNTS: 60,
      PRICE_STATISTICS: 55,
      PYTHON: 60,
      SQL: 60,
      DATA_VISUALIZATION: 60,
      AI_ML: 70,
      COMMUNICATION: 65,
      ETHICS: 65,
      GIS: 30,
      DATA_PRIVACY: 55,
    },
    weights: { SURVEY_DESIGN: 1, SAMPLING: 1, DATA_QUALITY: 0.9, PYTHON: 0.8, AI_ML: 0.7, SQL: 0.7, DATA_VISUALIZATION: 0.6, GIS: 0.4 },
  },
  {
    name: 'Data Scientist (Official Statistics)',
    code: 'DATA_SCIENTIST_OSS',
    description: 'Applies advanced analytics and ML to official data streams.',
    requirements: {
      PYTHON: 85,
      AI_ML: 85,
      SQL: 75,
      DATA_VISUALIZATION: 70,
      SAMPLING: 60,
      DATA_QUALITY: 70,
      CLOUD: 60,
      APIS: 60,
      ETHICS: 60,
    },
    weights: { PYTHON: 1, AI_ML: 1, SQL: 0.9, DATA_VISUALIZATION: 0.7, CLOUD: 0.6 },
  },
  {
    name: 'Training Officer',
    code: 'TRAINING_OFFICER',
    description: 'Plans and delivers training for statistical personnel.',
    requirements: {
      COMMUNICATION: 80,
      LEADERSHIP: 70,
      PROJECT_MANAGEMENT: 70,
      SURVEY_DESIGN: 55,
      DATA_VISUALIZATION: 50,
      ETHICS: 60,
    },
    weights: { COMMUNICATION: 1, LEADERSHIP: 0.9, PROJECT_MANAGEMENT: 0.8 },
  },
  {
    name: 'IT Officer (Statistical Systems)',
    code: 'IT_OFFICER',
    description: 'Builds and secures statistical IT systems.',
    requirements: {
      SQL: 80,
      APIS: 75,
      CYBERSECURITY: 75,
      CLOUD: 70,
      PYTHON: 65,
      DATA_PRIVACY: 70,
      DPI: 55,
    },
    weights: { SQL: 0.9, APIS: 1, CYBERSECURITY: 1, CLOUD: 0.9 },
  },
  {
    name: 'Administrative Officer',
    code: 'ADMINISTRATIVE_OFFICER',
    description: 'Supports administration of statistical programmes.',
    requirements: {
      COMMUNICATION: 65,
      PROJECT_MANAGEMENT: 60,
      DECISION_MAKING: 60,
      DATA_PRIVACY: 50,
      CYBERSECURITY: 50,
    },
    weights: { COMMUNICATION: 1, PROJECT_MANAGEMENT: 0.9 },
  },
];
