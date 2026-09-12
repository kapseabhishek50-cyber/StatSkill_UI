/** Competency taxonomy (prompt §4) — seeded into the Competency collection. */
export interface TaxonomyEntry {
  code: string;
  name: string;
  category: 'STATISTICAL' | 'TECHNICAL' | 'DIGITAL_GOVERNANCE' | 'BEHAVIOURAL';
  description: string;
  keywords: string[];
  defaultRequiredScore: number;
}

export const COMPETENCY_TAXONOMY: TaxonomyEntry[] = [
  // ---------- Statistical ----------
  { code: 'SURVEY_DESIGN', name: 'Survey Design', category: 'STATISTICAL', description: 'Designing official surveys: frames, instruments, modes, quality.', keywords: ['survey', 'questionnaire', 'frame', 'census'], defaultRequiredScore: 70 },
  { code: 'SAMPLING', name: 'Sampling', category: 'STATISTICAL', description: 'Probability sampling, stratification, weighting, estimation.', keywords: ['sampling', 'stratified', 'weighting', 'estimator'], defaultRequiredScore: 70 },
  { code: 'NATIONAL_ACCOUNTS', name: 'National Accounts', category: 'STATISTICAL', description: 'SNA framework, GDP compilation, supply-use tables.', keywords: ['gdp', 'sna', 'national accounts', 'gdp compilation'], defaultRequiredScore: 60 },
  { code: 'PRICE_STATISTICS', name: 'Price Statistics', category: 'STATISTICAL', description: 'CPI, WPI, index number theory, price collection.', keywords: ['cpi', 'wpi', 'price index', 'inflation'], defaultRequiredScore: 60 },
  { code: 'LABOUR_STATISTICS', name: 'Labour Statistics', category: 'STATISTICAL', description: 'PLFS, employment-unemployment frameworks, ILO standards.', keywords: ['plfs', 'employment', 'labour force', 'unemployment'], defaultRequiredScore: 60 },
  { code: 'AGRICULTURAL_STATISTICS', name: 'Agricultural Statistics', category: 'STATISTICAL', description: 'Crop area, yield estimation, agriculture censuses.', keywords: ['crop', 'agriculture', 'yield', 'land use'], defaultRequiredScore: 55 },
  { code: 'INDUSTRIAL_STATISTICS', name: 'Industrial Statistics', category: 'STATISTICAL', description: 'ASI, IIP, industrial production indices and surveys.', keywords: ['asi', 'iip', 'industrial', 'manufacturing'], defaultRequiredScore: 55 },
  { code: 'SDG_INDICATORS', name: 'SDG Indicators', category: 'STATISTICAL', description: 'SDG monitoring frameworks, indicator metadata, NIF.', keywords: ['sdg', 'indicator', 'nif', '2030 agenda'], defaultRequiredScore: 60 },
  { code: 'METADATA_STANDARDS', name: 'Metadata Standards', category: 'STATISTICAL', description: 'SDMX, DDI, GSBPM, metadata-driven exchange.', keywords: ['sdmx', 'ddi', 'gsbpm', 'metadata'], defaultRequiredScore: 55 },
  { code: 'DATA_QUALITY', name: 'Data Quality Frameworks', category: 'STATISTICAL', description: 'UN NQAF, accuracy, timeliness, coherence, accessibility.', keywords: ['quality', 'nqaf', 'accuracy', 'validation'], defaultRequiredScore: 70 },

  // ---------- Technical ----------
  { code: 'PYTHON', name: 'Python', category: 'TECHNICAL', description: 'Python programming for data analysis and automation.', keywords: ['python', 'pandas', 'numpy', 'programming'], defaultRequiredScore: 60 },
  { code: 'R', name: 'R', category: 'TECHNICAL', description: 'R for statistical computing and graphics.', keywords: ['r language', 'tidyverse', 'ggplot'], defaultRequiredScore: 55 },
  { code: 'SQL', name: 'SQL', category: 'TECHNICAL', description: 'Relational databases, queries, reporting SQL.', keywords: ['sql', 'database', 'query', 'postgres'], defaultRequiredScore: 60 },
  { code: 'STATA', name: 'Stata', category: 'TECHNICAL', description: 'Stata for survey data analysis.', keywords: ['stata'], defaultRequiredScore: 50 },
  { code: 'SPSS', name: 'SPSS', category: 'TECHNICAL', description: 'SPSS statistical package workflows.', keywords: ['spss'], defaultRequiredScore: 50 },
  { code: 'SAS', name: 'SAS', category: 'TECHNICAL', description: 'SAS analytics platform.', keywords: ['sas'], defaultRequiredScore: 50 },
  { code: 'GIS', name: 'GIS', category: 'TECHNICAL', description: 'Geospatial analysis, QGIS, remote sensing for statistics.', keywords: ['gis', 'geospatial', 'qgis', 'remote sensing', 'mapping'], defaultRequiredScore: 50 },
  { code: 'DATA_VISUALIZATION', name: 'Data Visualization', category: 'TECHNICAL', description: 'Charts, dashboards, storytelling with data.', keywords: ['visualization', 'dashboard', 'charts', 'powerbi', 'tableau'], defaultRequiredScore: 60 },
  { code: 'AI_ML', name: 'AI/ML', category: 'TECHNICAL', description: 'Machine learning, AI applications for official statistics.', keywords: ['machine learning', 'ai', 'ml', 'model', 'prediction', 'artificial intelligence'], defaultRequiredScore: 60 },
  { code: 'CLOUD', name: 'Cloud', category: 'TECHNICAL', description: 'Cloud platforms and deployment for statistical workloads.', keywords: ['cloud', 'aws', 'azure', 'gcp'], defaultRequiredScore: 50 },
  { code: 'APIS', name: 'APIs', category: 'TECHNICAL', description: 'REST APIs, data exchange, integration patterns.', keywords: ['api', 'rest', 'integration'], defaultRequiredScore: 55 },
  { code: 'OPEN_DATA', name: 'Open Data', category: 'TECHNICAL', description: 'Open data publication, licensing, data.gov.in.', keywords: ['open data', 'open government', 'data.gov.in'], defaultRequiredScore: 55 },

  // ---------- Digital Governance ----------
  { code: 'CYBERSECURITY', name: 'Cybersecurity', category: 'DIGITAL_GOVERNANCE', description: 'Security hygiene, threat awareness, incident response.', keywords: ['cyber', 'security', 'threat', 'phishing'], defaultRequiredScore: 60 },
  { code: 'DATA_PRIVACY', name: 'Data Privacy', category: 'DIGITAL_GOVERNANCE', description: 'DPDP Act, confidentiality of statistical returns.', keywords: ['privacy', 'dpdp', 'confidentiality', 'anonymisation'], defaultRequiredScore: 60 },
  { code: 'DIGITAL_SIGNATURES', name: 'Digital Signatures', category: 'DIGITAL_GOVERNANCE', description: 'PKI, DSC usage in government workflows.', keywords: ['digital signature', 'pki', 'dsc'], defaultRequiredScore: 50 },
  { code: 'GOV_CLOUD', name: 'Government Cloud', category: 'DIGITAL_GOVERNANCE', description: 'MeghRaj / GI cloud services for departments.', keywords: ['meghraj', 'gi cloud', 'gov cloud'], defaultRequiredScore: 50 },
  { code: 'DPI', name: 'Digital Public Infrastructure', category: 'DIGITAL_GOVERNANCE', description: 'India Stack, DPI building blocks.', keywords: ['dpi', 'india stack', 'aadhaar', 'upi'], defaultRequiredScore: 50 },

  // ---------- Behavioural ----------
  { code: 'LEADERSHIP', name: 'Leadership', category: 'BEHAVIOURAL', description: 'Leading teams and change in public institutions.', keywords: ['leadership', 'team management'], defaultRequiredScore: 55 },
  { code: 'COMMUNICATION', name: 'Communication', category: 'BEHAVIOURAL', description: 'Official writing, presentations, data storytelling.', keywords: ['communication', 'presentation', 'writing'], defaultRequiredScore: 60 },
  { code: 'PROJECT_MANAGEMENT', name: 'Project Management', category: 'BEHAVIOURAL', description: 'Planning, execution, monitoring of statistical projects.', keywords: ['project management', 'agile', 'planning'], defaultRequiredScore: 55 },
  { code: 'ETHICS', name: 'Ethics', category: 'BEHAVIOURAL', description: 'Statistical ethics, impartiality, professional integrity.', keywords: ['ethics', 'integrity', 'impartiality'], defaultRequiredScore: 60 },
  { code: 'DECISION_MAKING', name: 'Decision Making', category: 'BEHAVIOURAL', description: 'Evidence-based decision frameworks.', keywords: ['decision', 'evidence', 'judgement'], defaultRequiredScore: 55 },
  { code: 'CHANGE_MANAGEMENT', name: 'Change Management', category: 'BEHAVIOURAL', description: 'Driving adoption of new systems and processes.', keywords: ['change management', 'adoption'], defaultRequiredScore: 50 },
];
