import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { loadProductionSecrets } from '../config/ssm.js';
import { WELCOME_DOCUMENT_TITLE, WELCOME_DOCUMENT_CONTENT } from './welcomeDocument.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment (local dev only - production uses SSM)
config({ path: join(__dirname, '../../.env.local') });
config({ path: join(__dirname, '../../.env') });

// ============================================================================
// US Treasury Department — Production Seed Data
// ============================================================================
// This seed creates a realistic representation of Treasury IT modernization
// work across multiple bureaus and offices. All names are fictitious but
// organizational structure mirrors real Treasury bureaus.
// ============================================================================

/**
 * Helper to create document associations in the junction table
 */
async function createAssociation(
  pool: pg.Pool,
  documentId: string,
  relatedId: string,
  relationshipType: 'program' | 'project' | 'sprint',
  metadata?: Record<string, unknown>
): Promise<void> {
  await pool.query(
    `INSERT INTO document_associations (document_id, related_id, relationship_type, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (document_id, related_id, relationship_type) DO NOTHING`,
    [documentId, relatedId, relationshipType, JSON.stringify(metadata || { created_via: 'seed' })]
  );
}

/**
 * Helper to create TipTap document content
 */
function makeDoc(...blocks: object[]) {
  return { type: 'doc', content: blocks };
}

function heading(level: number, text: string) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function paragraph(text: string) {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function bulletList(...items: string[]) {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
    })),
  };
}

function boldParagraph(boldText: string, normalText: string) {
  return {
    type: 'paragraph',
    content: [
      { type: 'text', marks: [{ type: 'bold' }], text: boldText },
      { type: 'text', text: normalText },
    ],
  };
}

// ============================================================================
// DATA DEFINITIONS
// ============================================================================

// Treasury team members — realistic names and roles across bureaus
const teamMembers = [
  // Leadership
  { email: 'sarah.chen@treasury.gov', name: 'Sarah Chen', role: 'Deputy CIO, Digital Modernization' },
  { email: 'marcus.washington@treasury.gov', name: 'Marcus Washington', role: 'Director, Enterprise Architecture' },
  { email: 'patricia.rodriguez@treasury.gov', name: 'Patricia Rodriguez', role: 'Director, Cybersecurity Operations' },
  { email: 'james.nakamura@treasury.gov', name: 'James Nakamura', role: 'Director, Cloud Infrastructure' },

  // IRS Modernization team
  { email: 'rachel.goldberg@treasury.gov', name: 'Rachel Goldberg', role: 'Lead Engineer, IRS Modernization' },
  { email: 'devon.clark@treasury.gov', name: 'Devon Clark', role: 'Senior Developer, Tax Processing Systems' },
  { email: 'aisha.patel@treasury.gov', name: 'Aisha Patel', role: 'Full Stack Engineer, Taxpayer Portal' },
  { email: 'carlos.mendez@treasury.gov', name: 'Carlos Mendez', role: 'Backend Engineer, Filing Systems' },

  // FinCEN / BSA team
  { email: 'michael.oconnor@treasury.gov', name: 'Michael O\'Connor', role: 'Lead Analyst, FinCEN Systems' },
  { email: 'lisa.huang@treasury.gov', name: 'Lisa Huang', role: 'Data Engineer, BSA Analytics' },
  { email: 'kevin.jackson@treasury.gov', name: 'Kevin Jackson', role: 'Senior Developer, SAR Processing' },

  // BFS / Payment Systems team
  { email: 'natasha.volkov@treasury.gov', name: 'Natasha Volkov', role: 'Lead Engineer, Payment Systems' },
  { email: 'david.park@treasury.gov', name: 'David Park', role: 'Senior Developer, Disbursement Platform' },
  { email: 'jennifer.adams@treasury.gov', name: 'Jennifer Adams', role: 'Systems Engineer, ACH Processing' },

  // OCC / Bank Supervision
  { email: 'robert.singh@treasury.gov', name: 'Robert Singh', role: 'Lead Developer, Bank Supervision Tools' },
  { email: 'emily.foster@treasury.gov', name: 'Emily Foster', role: 'Frontend Engineer, Examiner Portal' },

  // Mint / Digital Assets
  { email: 'thomas.reyes@treasury.gov', name: 'Thomas Reyes', role: 'Lead Engineer, Digital Currency Research' },
  { email: 'amanda.wright@treasury.gov', name: 'Amanda Wright', role: 'Blockchain Developer, Digital Assets' },

  // OFAC / Sanctions
  { email: 'daniel.kim@treasury.gov', name: 'Daniel Kim', role: 'Lead Developer, Sanctions Screening' },
  { email: 'stephanie.brown@treasury.gov', name: 'Stephanie Brown', role: 'ML Engineer, Sanctions Analytics' },

  // Shared Services / Platform
  { email: 'andrew.martinez@treasury.gov', name: 'Andrew Martinez', role: 'Platform Engineer, Shared Services' },
  { email: 'michelle.lee@treasury.gov', name: 'Michelle Lee', role: 'DevOps Engineer, CI/CD Platform' },
  { email: 'christopher.taylor@treasury.gov', name: 'Christopher Taylor', role: 'SRE, Infrastructure' },
  { email: 'jessica.wilson@treasury.gov', name: 'Jessica Wilson', role: 'Security Engineer, Identity Platform' },

  // Data & Analytics
  { email: 'william.garcia@treasury.gov', name: 'William Garcia', role: 'Data Architect, Treasury Analytics' },
  { email: 'samantha.moore@treasury.gov', name: 'Samantha Moore', role: 'ML Engineer, Fraud Detection' },

  // UX / Design
  { email: 'alexandra.thomas@treasury.gov', name: 'Alexandra Thomas', role: 'UX Lead, Digital Services' },
  { email: 'benjamin.harris@treasury.gov', name: 'Benjamin Harris', role: 'UI/UX Designer, Public-Facing Systems' },

  // QA / Testing
  { email: 'maria.gonzalez@treasury.gov', name: 'Maria Gonzalez', role: 'QA Lead, Automated Testing' },
  { email: 'ryan.campbell@treasury.gov', name: 'Ryan Campbell', role: 'Test Engineer, Performance' },
];

// Reporting hierarchy (email → manager email)
const reportingHierarchy: Record<string, string> = {
  // Sarah Chen (Deputy CIO) — no manager in this workspace
  'marcus.washington@treasury.gov': 'sarah.chen@treasury.gov',
  'patricia.rodriguez@treasury.gov': 'sarah.chen@treasury.gov',
  'james.nakamura@treasury.gov': 'sarah.chen@treasury.gov',
  'alexandra.thomas@treasury.gov': 'sarah.chen@treasury.gov',

  // Marcus (Enterprise Architecture) manages bureau tech leads
  'rachel.goldberg@treasury.gov': 'marcus.washington@treasury.gov',
  'michael.oconnor@treasury.gov': 'marcus.washington@treasury.gov',
  'natasha.volkov@treasury.gov': 'marcus.washington@treasury.gov',
  'robert.singh@treasury.gov': 'marcus.washington@treasury.gov',
  'thomas.reyes@treasury.gov': 'marcus.washington@treasury.gov',
  'daniel.kim@treasury.gov': 'marcus.washington@treasury.gov',
  'william.garcia@treasury.gov': 'marcus.washington@treasury.gov',

  // Patricia (Cybersecurity) manages security engineers
  'jessica.wilson@treasury.gov': 'patricia.rodriguez@treasury.gov',
  'samantha.moore@treasury.gov': 'patricia.rodriguez@treasury.gov',
  'stephanie.brown@treasury.gov': 'patricia.rodriguez@treasury.gov',

  // James (Cloud Infrastructure) manages platform/DevOps
  'andrew.martinez@treasury.gov': 'james.nakamura@treasury.gov',
  'michelle.lee@treasury.gov': 'james.nakamura@treasury.gov',
  'christopher.taylor@treasury.gov': 'james.nakamura@treasury.gov',

  // IRS team reports to Rachel
  'devon.clark@treasury.gov': 'rachel.goldberg@treasury.gov',
  'aisha.patel@treasury.gov': 'rachel.goldberg@treasury.gov',
  'carlos.mendez@treasury.gov': 'rachel.goldberg@treasury.gov',

  // FinCEN team reports to Michael
  'lisa.huang@treasury.gov': 'michael.oconnor@treasury.gov',
  'kevin.jackson@treasury.gov': 'michael.oconnor@treasury.gov',

  // BFS team reports to Natasha
  'david.park@treasury.gov': 'natasha.volkov@treasury.gov',
  'jennifer.adams@treasury.gov': 'natasha.volkov@treasury.gov',

  // OCC reports to Robert
  'emily.foster@treasury.gov': 'robert.singh@treasury.gov',

  // Mint reports to Thomas
  'amanda.wright@treasury.gov': 'thomas.reyes@treasury.gov',

  // OFAC reports to Daniel
  // (stephanie already under Patricia for dotted-line security)

  // UX reports to Alexandra
  'benjamin.harris@treasury.gov': 'alexandra.thomas@treasury.gov',

  // QA reports to Marcus (cross-cutting)
  'maria.gonzalez@treasury.gov': 'marcus.washington@treasury.gov',
  'ryan.campbell@treasury.gov': 'maria.gonzalez@treasury.gov',
};

// Programs — major Treasury IT initiatives
const programDefinitions = [
  {
    prefix: 'IRS',
    name: 'IRS Modernization',
    color: '#2563EB',
    teamEmails: ['rachel.goldberg@treasury.gov', 'devon.clark@treasury.gov', 'aisha.patel@treasury.gov', 'carlos.mendez@treasury.gov', 'maria.gonzalez@treasury.gov'],
  },
  {
    prefix: 'FINCEN',
    name: 'FinCEN/BSA Compliance Platform',
    color: '#7C3AED',
    teamEmails: ['michael.oconnor@treasury.gov', 'lisa.huang@treasury.gov', 'kevin.jackson@treasury.gov', 'samantha.moore@treasury.gov'],
  },
  {
    prefix: 'BFS',
    name: 'Bureau of Fiscal Service — Payment Modernization',
    color: '#059669',
    teamEmails: ['natasha.volkov@treasury.gov', 'david.park@treasury.gov', 'jennifer.adams@treasury.gov', 'andrew.martinez@treasury.gov'],
  },
  {
    prefix: 'OCC',
    name: 'OCC Examiner Tools',
    color: '#D97706',
    teamEmails: ['robert.singh@treasury.gov', 'emily.foster@treasury.gov', 'benjamin.harris@treasury.gov'],
  },
  {
    prefix: 'OFAC',
    name: 'OFAC Sanctions Screening',
    color: '#DC2626',
    teamEmails: ['daniel.kim@treasury.gov', 'stephanie.brown@treasury.gov', 'jessica.wilson@treasury.gov'],
  },
  {
    prefix: 'CBDC',
    name: 'Digital Currency & Blockchain Research',
    color: '#0891B2',
    teamEmails: ['thomas.reyes@treasury.gov', 'amanda.wright@treasury.gov', 'william.garcia@treasury.gov'],
  },
  {
    prefix: 'PLAT',
    name: 'Shared Services Platform',
    color: '#4F46E5',
    teamEmails: ['james.nakamura@treasury.gov', 'andrew.martinez@treasury.gov', 'michelle.lee@treasury.gov', 'christopher.taylor@treasury.gov', 'jessica.wilson@treasury.gov'],
  },
  {
    prefix: 'DATA',
    name: 'Treasury Data & Analytics',
    color: '#0D9488',
    teamEmails: ['william.garcia@treasury.gov', 'samantha.moore@treasury.gov', 'lisa.huang@treasury.gov', 'ryan.campbell@treasury.gov'],
  },
];

// Project definitions per program
const projectDefinitions: Record<string, Array<{
  name: string;
  color: string;
  emoji: string;
  impact: number;
  confidence: number;
  ease: number;
  plan: string;
  monetary_impact_expected: number;
}>> = {
  IRS: [
    {
      name: 'Direct File — Free Filing Platform',
      color: '#2563EB', emoji: '📋',
      impact: 5, confidence: 4, ease: 2,
      plan: 'Build a free, government-run tax filing system for straightforward returns. Reduce taxpayer burden and processing costs by enabling direct e-filing without commercial software.',
      monetary_impact_expected: 50000000,
    },
    {
      name: 'Individual Master File Migration',
      color: '#1D4ED8', emoji: '🗄️',
      impact: 5, confidence: 3, ease: 1,
      plan: 'Migrate the 60-year-old Individual Master File from assembly/COBOL on IBM mainframes to a modern cloud-native architecture. Critical path for all downstream modernization.',
      monetary_impact_expected: 200000000,
    },
    {
      name: 'Taxpayer Digital Experience',
      color: '#3B82F6', emoji: '👤',
      impact: 4, confidence: 4, ease: 3,
      plan: 'Unified taxpayer portal with real-time refund tracking, document upload, secure messaging with agents, and mobile-responsive design meeting Section 508 standards.',
      monetary_impact_expected: 25000000,
    },
    {
      name: 'Automated Audit Selection (ML)',
      color: '#60A5FA', emoji: '🤖',
      impact: 4, confidence: 3, ease: 2,
      plan: 'ML models to improve audit selection accuracy, reducing burden on compliant taxpayers while improving detection of non-compliance. Must meet Taxpayer Bill of Rights requirements.',
      monetary_impact_expected: 75000000,
    },
  ],
  FINCEN: [
    {
      name: 'BSA E-Filing Modernization',
      color: '#7C3AED', emoji: '📑',
      impact: 5, confidence: 4, ease: 3,
      plan: 'Modernize the Bank Secrecy Act electronic filing system. Support CTRs, SARs, and beneficial ownership reports with improved validation, batch processing, and real-time status tracking.',
      monetary_impact_expected: 15000000,
    },
    {
      name: 'Beneficial Ownership Registry',
      color: '#6D28D9', emoji: '🏢',
      impact: 5, confidence: 3, ease: 2,
      plan: 'Build the Corporate Transparency Act beneficial ownership information registry. Secure storage and controlled access for 30M+ entity filings per year.',
      monetary_impact_expected: 30000000,
    },
    {
      name: 'Suspicious Activity Analytics',
      color: '#8B5CF6', emoji: '🔍',
      impact: 4, confidence: 3, ease: 2,
      plan: 'Advanced analytics platform for SAR data. Graph analysis for network detection, NLP for narrative analysis, and risk scoring for financial institutions.',
      monetary_impact_expected: 20000000,
    },
  ],
  BFS: [
    {
      name: 'Real-Time Payments Infrastructure',
      color: '#059669', emoji: '⚡',
      impact: 5, confidence: 4, ease: 2,
      plan: 'Modernize government payment rails to support real-time disbursements. Integration with FedNow for instant Social Security, tax refund, and emergency payments.',
      monetary_impact_expected: 100000000,
    },
    {
      name: 'Payment Integrity & Fraud Prevention',
      color: '#047857', emoji: '🛡️',
      impact: 5, confidence: 4, ease: 3,
      plan: 'ML-powered payment verification to reduce improper payments. Pre-payment validation, identity verification, and real-time fraud detection across all federal disbursements.',
      monetary_impact_expected: 500000000,
    },
    {
      name: 'Debt Collection Modernization',
      color: '#10B981', emoji: '💰',
      impact: 3, confidence: 4, ease: 3,
      plan: 'Replace legacy debt collection systems with modern APIs. Improve debtor experience with self-service portals, payment plans, and clear communication.',
      monetary_impact_expected: 35000000,
    },
  ],
  OCC: [
    {
      name: 'Examiner Workstation Modernization',
      color: '#D97706', emoji: '💻',
      impact: 4, confidence: 4, ease: 3,
      plan: 'Replace legacy examiner tools with modern web application. Risk dashboards, automated report generation, secure document sharing with banks, and offline-capable for on-site exams.',
      monetary_impact_expected: 12000000,
    },
    {
      name: 'Bank Supervision Data Platform',
      color: '#B45309', emoji: '📊',
      impact: 4, confidence: 3, ease: 2,
      plan: 'Centralized analytics platform for bank supervision data. Call report analysis, peer comparisons, trend detection, and early warning indicators for bank health.',
      monetary_impact_expected: 8000000,
    },
  ],
  OFAC: [
    {
      name: 'SDN List Screening Engine',
      color: '#DC2626', emoji: '🚨',
      impact: 5, confidence: 4, ease: 2,
      plan: 'Next-gen screening engine for Specially Designated Nationals list. Fuzzy matching, transliteration support, real-time updates, and sub-second response times for financial institutions.',
      monetary_impact_expected: 20000000,
    },
    {
      name: 'Sanctions Compliance Analytics',
      color: '#B91C1C', emoji: '📈',
      impact: 4, confidence: 3, ease: 2,
      plan: 'Analytics platform for sanctions evasion detection. Cryptocurrency tracing, trade-based money laundering detection, and network analysis across global financial data.',
      monetary_impact_expected: 15000000,
    },
  ],
  CBDC: [
    {
      name: 'Digital Dollar Research Platform',
      color: '#0891B2', emoji: '🪙',
      impact: 4, confidence: 2, ease: 1,
      plan: 'Research and prototyping platform for potential US CBDC. Privacy-preserving transaction design, offline capability, programmable money features, and interoperability with existing payment rails.',
      monetary_impact_expected: 5000000,
    },
    {
      name: 'Blockchain Analytics Toolkit',
      color: '#0E7490', emoji: '🔗',
      impact: 3, confidence: 3, ease: 3,
      plan: 'Open-source toolkit for analyzing blockchain transactions across major networks. Support Treasury enforcement, FinCEN investigations, and OFAC sanctions compliance.',
      monetary_impact_expected: 3000000,
    },
  ],
  PLAT: [
    {
      name: 'Treasury Cloud Migration (AWS GovCloud)',
      color: '#4F46E5', emoji: '☁️',
      impact: 5, confidence: 4, ease: 2,
      plan: 'Migrate Treasury workloads from on-prem data centers to AWS GovCloud. FedRAMP High compliance, zero-trust networking, and automated infrastructure-as-code deployments.',
      monetary_impact_expected: 40000000,
    },
    {
      name: 'Identity & Access Management (ICAM)',
      color: '#4338CA', emoji: '🔐',
      impact: 5, confidence: 4, ease: 2,
      plan: 'Implement NIST 800-63-3 compliant identity platform. PIV/CAC authentication, FIDO2 passwordless for external users, and unified SSO across all Treasury applications.',
      monetary_impact_expected: 15000000,
    },
    {
      name: 'DevSecOps Pipeline',
      color: '#6366F1', emoji: '🔧',
      impact: 4, confidence: 5, ease: 3,
      plan: 'Standardized CI/CD pipeline for all Treasury applications. Automated STIG compliance scanning, container security, SBOM generation, and deployment to GovCloud.',
      monetary_impact_expected: 8000000,
    },
  ],
  DATA: [
    {
      name: 'Treasury Data Lake',
      color: '#0D9488', emoji: '🌊',
      impact: 5, confidence: 3, ease: 2,
      plan: 'Enterprise data lake consolidating data from IRS, FinCEN, BFS, and OCC. Delta Lake format, governed data mesh architecture, and self-service analytics for analysts.',
      monetary_impact_expected: 25000000,
    },
    {
      name: 'AI/ML Platform (TreasuryAI)',
      color: '#0F766E', emoji: '🧠',
      impact: 4, confidence: 3, ease: 2,
      plan: 'Shared ML platform with model registry, feature store, and responsible AI governance. Pre-built models for fraud detection, document classification, and anomaly detection.',
      monetary_impact_expected: 18000000,
    },
    {
      name: 'Open Data & Transparency Portal',
      color: '#14B8A6', emoji: '🌐',
      impact: 3, confidence: 4, ease: 4,
      plan: 'Public-facing data portal for Treasury datasets. API-first design, interactive visualizations, and machine-readable formats. Supports DATA Act and FOIA compliance.',
      monetary_impact_expected: 5000000,
    },
  ],
};

// Issue definitions per program (comprehensive, realistic)
const issueDefinitions: Record<string, Array<{
  title: string;
  state: string;
  priority: string;
  estimate: number;
  sprintOffset: number | null;
  projectIndex: number; // which project within the program
}>> = {
  IRS: [
    // Direct File
    { title: 'Implement W-2 income import via API', state: 'done', priority: 'high', estimate: 8, sprintOffset: -3, projectIndex: 0 },
    { title: 'Build 1099-INT/DIV support for investment income', state: 'done', priority: 'high', estimate: 6, sprintOffset: -3, projectIndex: 0 },
    { title: 'Create standard deduction calculator', state: 'done', priority: 'high', estimate: 4, sprintOffset: -2, projectIndex: 0 },
    { title: 'Implement state tax return integration (12 pilot states)', state: 'done', priority: 'high', estimate: 12, sprintOffset: -2, projectIndex: 0 },
    { title: 'Add Earned Income Tax Credit (EITC) eligibility wizard', state: 'done', priority: 'high', estimate: 8, sprintOffset: -1, projectIndex: 0 },
    { title: 'Build e-signature flow compliant with IRS e-file requirements', state: 'in_progress', priority: 'high', estimate: 6, sprintOffset: 0, projectIndex: 0 },
    { title: 'Implement real-time return validation against IRS business rules', state: 'in_progress', priority: 'high', estimate: 10, sprintOffset: 0, projectIndex: 0 },
    { title: 'Add support for dependents and child tax credits', state: 'todo', priority: 'high', estimate: 8, sprintOffset: 0, projectIndex: 0 },
    { title: 'Create Spanish language version of filing flow', state: 'todo', priority: 'medium', estimate: 6, sprintOffset: 1, projectIndex: 0 },
    { title: 'Build accessibility audit remediation (Section 508)', state: 'todo', priority: 'high', estimate: 8, sprintOffset: 1, projectIndex: 0 },
    { title: 'Add support for Schedule C (self-employment income)', state: 'backlog', priority: 'medium', estimate: 12, sprintOffset: null, projectIndex: 0 },
    { title: 'Implement MFA enrollment during filing (Login.gov integration)', state: 'backlog', priority: 'high', estimate: 6, sprintOffset: null, projectIndex: 0 },

    // IMF Migration
    { title: 'Document existing IMF COBOL batch processing flows', state: 'done', priority: 'high', estimate: 16, sprintOffset: -3, projectIndex: 1 },
    { title: 'Design event-sourced taxpayer account data model', state: 'done', priority: 'high', estimate: 12, sprintOffset: -2, projectIndex: 1 },
    { title: 'Build taxpayer account microservice (read path)', state: 'done', priority: 'high', estimate: 10, sprintOffset: -1, projectIndex: 1 },
    { title: 'Implement dual-write strategy for parallel running', state: 'in_progress', priority: 'high', estimate: 12, sprintOffset: 0, projectIndex: 1 },
    { title: 'Create data reconciliation pipeline (mainframe vs cloud)', state: 'in_progress', priority: 'high', estimate: 8, sprintOffset: 0, projectIndex: 1 },
    { title: 'Build account balance query API with sub-100ms latency', state: 'todo', priority: 'high', estimate: 8, sprintOffset: 1, projectIndex: 1 },
    { title: 'Migrate refund processing logic from assembly to Java', state: 'todo', priority: 'high', estimate: 20, sprintOffset: 1, projectIndex: 1 },
    { title: 'Design disaster recovery for cloud taxpayer accounts', state: 'backlog', priority: 'medium', estimate: 10, sprintOffset: null, projectIndex: 1 },

    // Taxpayer Digital Experience
    { title: 'Build unified login with Login.gov SSO', state: 'done', priority: 'high', estimate: 8, sprintOffset: -3, projectIndex: 2 },
    { title: 'Create "Where\'s My Refund" real-time status API', state: 'done', priority: 'high', estimate: 6, sprintOffset: -2, projectIndex: 2 },
    { title: 'Implement secure document upload (encrypted at rest)', state: 'done', priority: 'high', estimate: 8, sprintOffset: -1, projectIndex: 2 },
    { title: 'Build secure messaging between taxpayer and IRS agent', state: 'in_progress', priority: 'medium', estimate: 10, sprintOffset: 0, projectIndex: 2 },
    { title: 'Create mobile-responsive account dashboard', state: 'todo', priority: 'medium', estimate: 6, sprintOffset: 1, projectIndex: 2 },
    { title: 'Add payment plan self-service enrollment', state: 'backlog', priority: 'medium', estimate: 8, sprintOffset: null, projectIndex: 2 },

    // Automated Audit Selection
    { title: 'Build feature engineering pipeline for return data', state: 'done', priority: 'high', estimate: 10, sprintOffset: -2, projectIndex: 3 },
    { title: 'Train XGBoost model on historical audit outcomes', state: 'done', priority: 'high', estimate: 8, sprintOffset: -1, projectIndex: 3 },
    { title: 'Implement fairness constraints (demographic parity)', state: 'in_progress', priority: 'high', estimate: 10, sprintOffset: 0, projectIndex: 3 },
    { title: 'Build model explainability dashboard (SHAP values)', state: 'todo', priority: 'high', estimate: 8, sprintOffset: 1, projectIndex: 3 },
    { title: 'Create A/B testing framework for model comparison', state: 'backlog', priority: 'medium', estimate: 6, sprintOffset: null, projectIndex: 3 },
    { title: 'Implement Taxpayer Advocate review workflow for ML decisions', state: 'backlog', priority: 'high', estimate: 8, sprintOffset: null, projectIndex: 3 },
  ],

  FINCEN: [
    // BSA E-Filing
    { title: 'Redesign CTR filing form with real-time validation', state: 'done', priority: 'high', estimate: 8, sprintOffset: -3, projectIndex: 0 },
    { title: 'Implement batch upload for large filer institutions', state: 'done', priority: 'high', estimate: 10, sprintOffset: -2, projectIndex: 0 },
    { title: 'Build filing status dashboard with SLA tracking', state: 'done', priority: 'medium', estimate: 6, sprintOffset: -1, projectIndex: 0 },
    { title: 'Add XML schema validation for SAR narratives', state: 'in_progress', priority: 'high', estimate: 6, sprintOffset: 0, projectIndex: 0 },
    { title: 'Create automated acknowledgment system for filers', state: 'todo', priority: 'medium', estimate: 4, sprintOffset: 0, projectIndex: 0 },
    { title: 'Build API gateway for programmatic filing access', state: 'todo', priority: 'high', estimate: 8, sprintOffset: 1, projectIndex: 0 },

    // Beneficial Ownership Registry
    { title: 'Design entity resolution algorithm for matching beneficial owners', state: 'done', priority: 'high', estimate: 12, sprintOffset: -3, projectIndex: 1 },
    { title: 'Build secure document vault for FinCEN ID verification', state: 'done', priority: 'high', estimate: 8, sprintOffset: -2, projectIndex: 1 },
    { title: 'Implement access control for law enforcement queries', state: 'done', priority: 'high', estimate: 10, sprintOffset: -1, projectIndex: 1 },
    { title: 'Create reporting company registration portal', state: 'in_progress', priority: 'high', estimate: 8, sprintOffset: 0, projectIndex: 1 },
    { title: 'Build audit trail for all beneficial ownership data access', state: 'in_progress', priority: 'high', estimate: 6, sprintOffset: 0, projectIndex: 1 },
    { title: 'Implement foreign pooled investment vehicle reporting', state: 'todo', priority: 'medium', estimate: 8, sprintOffset: 1, projectIndex: 1 },
    { title: 'Add automated change detection for entity updates', state: 'backlog', priority: 'medium', estimate: 6, sprintOffset: null, projectIndex: 1 },

    // Suspicious Activity Analytics
    { title: 'Build graph database for transaction network analysis', state: 'done', priority: 'high', estimate: 10, sprintOffset: -2, projectIndex: 2 },
    { title: 'Implement NLP pipeline for SAR narrative extraction', state: 'done', priority: 'high', estimate: 8, sprintOffset: -1, projectIndex: 2 },
    { title: 'Create risk scoring model for financial institutions', state: 'in_progress', priority: 'high', estimate: 10, sprintOffset: 0, projectIndex: 2 },
    { title: 'Build cryptocurrency transaction tracing integration', state: 'todo', priority: 'high', estimate: 12, sprintOffset: 1, projectIndex: 2 },
    { title: 'Design alert correlation engine for cross-institution patterns', state: 'backlog', priority: 'medium', estimate: 10, sprintOffset: null, projectIndex: 2 },
  ],

  BFS: [
    // Real-Time Payments
    { title: 'Integrate FedNow API for instant payment initiation', state: 'done', priority: 'high', estimate: 12, sprintOffset: -3, projectIndex: 0 },
    { title: 'Build payment routing engine (ACH vs FedNow vs wire)', state: 'done', priority: 'high', estimate: 10, sprintOffset: -2, projectIndex: 0 },
    { title: 'Implement idempotency and exactly-once delivery for payments', state: 'done', priority: 'high', estimate: 8, sprintOffset: -1, projectIndex: 0 },
    { title: 'Create payment status webhook notification system', state: 'in_progress', priority: 'high', estimate: 6, sprintOffset: 0, projectIndex: 0 },
    { title: 'Build emergency payment fast-track for disaster relief', state: 'in_progress', priority: 'high', estimate: 8, sprintOffset: 0, projectIndex: 0 },
    { title: 'Add support for digital wallet disbursements', state: 'todo', priority: 'medium', estimate: 8, sprintOffset: 1, projectIndex: 0 },
    { title: 'Implement real-time payment reconciliation dashboard', state: 'backlog', priority: 'medium', estimate: 6, sprintOffset: null, projectIndex: 0 },

    // Payment Integrity
    { title: 'Build pre-payment identity verification service', state: 'done', priority: 'high', estimate: 10, sprintOffset: -3, projectIndex: 1 },
    { title: 'Implement Do Not Pay integration for all disbursements', state: 'done', priority: 'high', estimate: 8, sprintOffset: -2, projectIndex: 1 },
    { title: 'Create ML model for duplicate payment detection', state: 'done', priority: 'high', estimate: 10, sprintOffset: -1, projectIndex: 1 },
    { title: 'Build real-time fraud scoring API (sub-50ms SLA)', state: 'in_progress', priority: 'high', estimate: 8, sprintOffset: 0, projectIndex: 1 },
    { title: 'Implement deceased person payment intercept', state: 'in_progress', priority: 'high', estimate: 6, sprintOffset: 0, projectIndex: 1 },
    { title: 'Create payment recovery workflow for identified overpayments', state: 'todo', priority: 'medium', estimate: 8, sprintOffset: 1, projectIndex: 1 },
    { title: 'Add bank account ownership verification via ACH prenotes', state: 'backlog', priority: 'medium', estimate: 6, sprintOffset: null, projectIndex: 1 },

    // Debt Collection
    { title: 'Build debtor self-service portal', state: 'done', priority: 'medium', estimate: 8, sprintOffset: -2, projectIndex: 2 },
    { title: 'Implement installment agreement API', state: 'in_progress', priority: 'medium', estimate: 6, sprintOffset: 0, projectIndex: 2 },
    { title: 'Create automated payment plan eligibility calculator', state: 'todo', priority: 'medium', estimate: 4, sprintOffset: 1, projectIndex: 2 },
    { title: 'Add hardship application workflow', state: 'backlog', priority: 'low', estimate: 6, sprintOffset: null, projectIndex: 2 },
  ],

  OCC: [
    // Examiner Workstation
    { title: 'Build bank risk dashboard with CAMELS component scoring', state: 'done', priority: 'high', estimate: 10, sprintOffset: -3, projectIndex: 0 },
    { title: 'Create examination report auto-generation from findings', state: 'done', priority: 'high', estimate: 8, sprintOffset: -2, projectIndex: 0 },
    { title: 'Implement secure document exchange portal with banks', state: 'done', priority: 'high', estimate: 8, sprintOffset: -1, projectIndex: 0 },
    { title: 'Build offline-capable workstation for on-site bank exams', state: 'in_progress', priority: 'high', estimate: 10, sprintOffset: 0, projectIndex: 0 },
    { title: 'Create findings tracking and remediation workflow', state: 'in_progress', priority: 'medium', estimate: 6, sprintOffset: 0, projectIndex: 0 },
    { title: 'Add peer comparison analytics for similar-sized banks', state: 'todo', priority: 'medium', estimate: 8, sprintOffset: 1, projectIndex: 0 },
    { title: 'Implement examination scheduling and resource allocation', state: 'backlog', priority: 'low', estimate: 6, sprintOffset: null, projectIndex: 0 },

    // Bank Supervision Data
    { title: 'Build Call Report ingestion and validation pipeline', state: 'done', priority: 'high', estimate: 8, sprintOffset: -2, projectIndex: 1 },
    { title: 'Create early warning system for bank stress indicators', state: 'in_progress', priority: 'high', estimate: 10, sprintOffset: 0, projectIndex: 1 },
    { title: 'Implement CRA lending pattern analysis dashboard', state: 'todo', priority: 'medium', estimate: 8, sprintOffset: 1, projectIndex: 1 },
    { title: 'Add CECL impact modeling for supervised banks', state: 'backlog', priority: 'medium', estimate: 10, sprintOffset: null, projectIndex: 1 },
  ],

  OFAC: [
    // SDN Screening
    { title: 'Implement Jaro-Winkler + phonetic fuzzy matching engine', state: 'done', priority: 'high', estimate: 10, sprintOffset: -3, projectIndex: 0 },
    { title: 'Add Arabic/Cyrillic/Chinese transliteration support', state: 'done', priority: 'high', estimate: 8, sprintOffset: -2, projectIndex: 0 },
    { title: 'Build real-time SDN list update propagation (< 60s)', state: 'done', priority: 'high', estimate: 6, sprintOffset: -1, projectIndex: 0 },
    { title: 'Create screening API with 99.99% uptime SLA', state: 'in_progress', priority: 'high', estimate: 8, sprintOffset: 0, projectIndex: 0 },
    { title: 'Implement vessel and aircraft screening capabilities', state: 'todo', priority: 'high', estimate: 8, sprintOffset: 1, projectIndex: 0 },
    { title: 'Add batch screening for large transaction files', state: 'todo', priority: 'medium', estimate: 6, sprintOffset: 1, projectIndex: 0 },
    { title: 'Build screening performance benchmarking suite', state: 'backlog', priority: 'low', estimate: 4, sprintOffset: null, projectIndex: 0 },

    // Sanctions Compliance Analytics
    { title: 'Build cryptocurrency wallet clustering algorithm', state: 'done', priority: 'high', estimate: 12, sprintOffset: -2, projectIndex: 1 },
    { title: 'Implement trade-based money laundering detection', state: 'in_progress', priority: 'high', estimate: 10, sprintOffset: 0, projectIndex: 1 },
    { title: 'Create sanctions evasion network visualization', state: 'todo', priority: 'medium', estimate: 8, sprintOffset: 1, projectIndex: 1 },
    { title: 'Add Russian oligarch asset tracing capabilities', state: 'backlog', priority: 'high', estimate: 12, sprintOffset: null, projectIndex: 1 },
  ],

  CBDC: [
    // Digital Dollar Research
    { title: 'Design privacy-preserving transaction protocol (zk-SNARKs)', state: 'done', priority: 'high', estimate: 16, sprintOffset: -3, projectIndex: 0 },
    { title: 'Build offline payment simulation environment', state: 'done', priority: 'high', estimate: 10, sprintOffset: -2, projectIndex: 0 },
    { title: 'Create programmable money smart contract framework', state: 'in_progress', priority: 'high', estimate: 12, sprintOffset: 0, projectIndex: 0 },
    { title: 'Implement cross-border CBDC interoperability prototype', state: 'todo', priority: 'medium', estimate: 16, sprintOffset: 1, projectIndex: 0 },
    { title: 'Build CBDC issuance and redemption simulation', state: 'backlog', priority: 'medium', estimate: 10, sprintOffset: null, projectIndex: 0 },
    { title: 'Research quantum-resistant cryptography for digital dollar', state: 'backlog', priority: 'low', estimate: 20, sprintOffset: null, projectIndex: 0 },

    // Blockchain Analytics
    { title: 'Build multi-chain transaction ingestion pipeline', state: 'done', priority: 'high', estimate: 8, sprintOffset: -2, projectIndex: 1 },
    { title: 'Implement address clustering and de-anonymization', state: 'done', priority: 'high', estimate: 10, sprintOffset: -1, projectIndex: 1 },
    { title: 'Create DeFi protocol interaction analyzer', state: 'in_progress', priority: 'medium', estimate: 8, sprintOffset: 0, projectIndex: 1 },
    { title: 'Add NFT marketplace transaction tracing', state: 'todo', priority: 'low', estimate: 6, sprintOffset: 1, projectIndex: 1 },
    { title: 'Build bridge transaction tracking across L1/L2 networks', state: 'backlog', priority: 'medium', estimate: 10, sprintOffset: null, projectIndex: 1 },
  ],

  PLAT: [
    // Cloud Migration
    { title: 'Set up AWS GovCloud organization with SCPs', state: 'done', priority: 'high', estimate: 8, sprintOffset: -3, projectIndex: 0 },
    { title: 'Create Terraform modules for FedRAMP High baseline', state: 'done', priority: 'high', estimate: 12, sprintOffset: -3, projectIndex: 0 },
    { title: 'Build network architecture with Transit Gateway', state: 'done', priority: 'high', estimate: 10, sprintOffset: -2, projectIndex: 0 },
    { title: 'Implement zero-trust network segmentation', state: 'done', priority: 'high', estimate: 8, sprintOffset: -1, projectIndex: 0 },
    { title: 'Migrate IRS Taxpayer Portal to EKS', state: 'in_progress', priority: 'high', estimate: 12, sprintOffset: 0, projectIndex: 0 },
    { title: 'Set up cross-region disaster recovery', state: 'in_progress', priority: 'high', estimate: 10, sprintOffset: 0, projectIndex: 0 },
    { title: 'Build cost allocation and chargeback system', state: 'todo', priority: 'medium', estimate: 6, sprintOffset: 1, projectIndex: 0 },
    { title: 'Create automated compliance scanning for CIS benchmarks', state: 'backlog', priority: 'medium', estimate: 8, sprintOffset: null, projectIndex: 0 },

    // ICAM
    { title: 'Integrate PIV/CAC authentication for internal users', state: 'done', priority: 'high', estimate: 10, sprintOffset: -3, projectIndex: 1 },
    { title: 'Build SAML/OIDC federation with Login.gov', state: 'done', priority: 'high', estimate: 8, sprintOffset: -2, projectIndex: 1 },
    { title: 'Implement FIDO2 passwordless for external users', state: 'done', priority: 'high', estimate: 8, sprintOffset: -1, projectIndex: 1 },
    { title: 'Create centralized authorization service (OPA-based)', state: 'in_progress', priority: 'high', estimate: 10, sprintOffset: 0, projectIndex: 1 },
    { title: 'Build identity proofing integration for new user enrollment', state: 'todo', priority: 'high', estimate: 8, sprintOffset: 1, projectIndex: 1 },
    { title: 'Add session management with risk-adaptive authentication', state: 'backlog', priority: 'medium', estimate: 6, sprintOffset: null, projectIndex: 1 },

    // DevSecOps
    { title: 'Build standardized CI/CD pipeline templates (GitHub Actions)', state: 'done', priority: 'high', estimate: 8, sprintOffset: -2, projectIndex: 2 },
    { title: 'Implement automated STIG compliance scanning', state: 'done', priority: 'high', estimate: 6, sprintOffset: -1, projectIndex: 2 },
    { title: 'Create container image scanning and signing pipeline', state: 'in_progress', priority: 'high', estimate: 6, sprintOffset: 0, projectIndex: 2 },
    { title: 'Build SBOM generation and vulnerability tracking', state: 'in_progress', priority: 'high', estimate: 6, sprintOffset: 0, projectIndex: 2 },
    { title: 'Implement automated ATO evidence collection', state: 'todo', priority: 'medium', estimate: 8, sprintOffset: 1, projectIndex: 2 },
    { title: 'Create developer self-service environment provisioning', state: 'backlog', priority: 'medium', estimate: 6, sprintOffset: null, projectIndex: 2 },
  ],

  DATA: [
    // Treasury Data Lake
    { title: 'Set up Delta Lake on S3 with Glue catalog', state: 'done', priority: 'high', estimate: 8, sprintOffset: -3, projectIndex: 0 },
    { title: 'Build IRS return data ingestion pipeline', state: 'done', priority: 'high', estimate: 10, sprintOffset: -2, projectIndex: 0 },
    { title: 'Implement data quality framework with Great Expectations', state: 'done', priority: 'high', estimate: 8, sprintOffset: -1, projectIndex: 0 },
    { title: 'Create governed data mesh domain for FinCEN', state: 'in_progress', priority: 'high', estimate: 10, sprintOffset: 0, projectIndex: 0 },
    { title: 'Build real-time streaming ingestion for payment data', state: 'in_progress', priority: 'high', estimate: 8, sprintOffset: 0, projectIndex: 0 },
    { title: 'Implement PII detection and masking pipeline', state: 'todo', priority: 'high', estimate: 8, sprintOffset: 1, projectIndex: 0 },
    { title: 'Create self-service SQL analytics workspace', state: 'backlog', priority: 'medium', estimate: 6, sprintOffset: null, projectIndex: 0 },

    // AI/ML Platform
    { title: 'Deploy MLflow model registry on GovCloud', state: 'done', priority: 'high', estimate: 6, sprintOffset: -2, projectIndex: 1 },
    { title: 'Build feature store with online/offline serving', state: 'done', priority: 'high', estimate: 10, sprintOffset: -1, projectIndex: 1 },
    { title: 'Create responsible AI governance dashboard', state: 'in_progress', priority: 'high', estimate: 8, sprintOffset: 0, projectIndex: 1 },
    { title: 'Implement model monitoring and drift detection', state: 'todo', priority: 'high', estimate: 8, sprintOffset: 1, projectIndex: 1 },
    { title: 'Build pre-trained NLP models for government document classification', state: 'backlog', priority: 'medium', estimate: 12, sprintOffset: null, projectIndex: 1 },

    // Open Data Portal
    { title: 'Build API gateway for public dataset access', state: 'done', priority: 'high', estimate: 6, sprintOffset: -2, projectIndex: 2 },
    { title: 'Create interactive data visualization components', state: 'done', priority: 'medium', estimate: 8, sprintOffset: -1, projectIndex: 2 },
    { title: 'Implement dataset search and discovery', state: 'in_progress', priority: 'medium', estimate: 6, sprintOffset: 0, projectIndex: 2 },
    { title: 'Add machine-readable format export (CSV, JSON, Parquet)', state: 'todo', priority: 'medium', estimate: 4, sprintOffset: 1, projectIndex: 2 },
    { title: 'Build automated data freshness monitoring', state: 'backlog', priority: 'low', estimate: 4, sprintOffset: null, projectIndex: 2 },
  ],
};

// Wiki documentation tree
const wikiDocuments = [
  // Top-level organizational docs
  {
    title: 'Treasury IT Strategic Plan FY2025-2029',
    content: makeDoc(
      heading(1, 'Treasury IT Strategic Plan FY2025-2029'),
      paragraph('This document outlines the Department of the Treasury\'s information technology strategic priorities for fiscal years 2025 through 2029. Our mission is to modernize Treasury\'s technology infrastructure while maintaining the highest standards of security, privacy, and public trust.'),
      heading(2, 'Strategic Goals'),
      bulletList(
        'Goal 1: Modernize Legacy Systems — Migrate critical tax processing, payment, and financial systems from mainframes to cloud-native architectures',
        'Goal 2: Strengthen Cybersecurity Posture — Implement zero-trust architecture across all Treasury bureaus and offices',
        'Goal 3: Enable Data-Driven Decision Making — Build enterprise analytics capabilities and responsible AI governance',
        'Goal 4: Improve Public-Facing Digital Services — Deliver accessible, mobile-friendly services that reduce taxpayer burden',
        'Goal 5: Enhance Financial System Integrity — Modernize anti-money laundering, sanctions enforcement, and financial supervision tools',
      ),
      heading(2, 'Investment Priorities'),
      paragraph('Total IT modernization budget: $4.75B over 5 years. Allocation: IRS Modernization (40%), Shared Infrastructure (20%), Financial Crime/Sanctions (15%), Payment Systems (15%), Research & Innovation (10%).'),
      heading(2, 'Governance'),
      paragraph('The Treasury IT Investment Review Board (ITIRB) meets monthly to review progress against this plan. Bureau CIOs report quarterly on modernization milestones. All investments exceeding $25M require ITIRB approval.'),
    ),
    children: [
      {
        title: 'FY2025 Q1 Progress Report',
        content: makeDoc(
          heading(1, 'FY2025 Q1 Progress Report'),
          heading(2, 'Executive Summary'),
          paragraph('Treasury IT modernization is on track for 72% of milestones. Key achievements include completion of AWS GovCloud foundation, launch of IRS Direct File pilot in 12 states, and deployment of FinCEN beneficial ownership reporting portal.'),
          heading(2, 'Highlights'),
          bulletList(
            'IRS Direct File processed 140,000 returns in pilot states with 93% user satisfaction',
            'FinCEN beneficial ownership portal received 2.1M filings (ahead of 1.8M target)',
            'Cloud migration: 23 of 87 applications migrated (26% complete, on track for 50% by EOY)',
            'Zero significant cybersecurity incidents across all Treasury systems',
          ),
          heading(2, 'Risks'),
          bulletList(
            'IMF mainframe migration timeline at risk due to complexity of COBOL batch processes',
            'FinCEN beneficial ownership registry approaching storage capacity limits',
            'Key personnel attrition in cybersecurity team (4 departures in Q1)',
          ),
        ),
      },
      {
        title: 'FY2025 Q2 Progress Report',
        content: makeDoc(
          heading(1, 'FY2025 Q2 Progress Report'),
          heading(2, 'Executive Summary'),
          paragraph('Strong progress across all programs. Direct File expansion to 24 states approved. BFS real-time payment pilot launched with Social Security Administration. OFAC screening engine performance improved 3x.'),
          heading(2, 'Key Metrics'),
          bulletList(
            'IRS Direct File: 450,000 cumulative returns filed, $12.3M in taxpayer savings on preparation fees',
            'BFS: First real-time Social Security payment disbursed via FedNow (January 15)',
            'OFAC: Screening latency reduced from 850ms to 280ms (67% improvement)',
            'Cloud migration: 35 of 87 applications migrated (40% complete)',
            'PLAT: DevSecOps pipeline adopted by 6 of 8 bureau development teams',
          ),
        ),
      },
    ],
  },
  {
    title: 'Architecture Decision Records',
    content: makeDoc(
      heading(1, 'Architecture Decision Records (ADRs)'),
      paragraph('This section captures significant architecture decisions for Treasury IT systems. Each ADR documents the context, decision, and consequences of architectural choices that affect multiple bureaus or systems.'),
      paragraph('ADRs follow the format: Status, Context, Decision, Consequences. All ADRs require review by the Enterprise Architecture Review Board (EARB) before implementation.'),
    ),
    children: [
      {
        title: 'ADR-001: AWS GovCloud as Primary Cloud Provider',
        content: makeDoc(
          heading(1, 'ADR-001: AWS GovCloud as Primary Cloud Provider'),
          boldParagraph('Status: ', 'Accepted (2024-03-15)'),
          heading(2, 'Context'),
          paragraph('Treasury needs a FedRAMP High authorized cloud platform for hosting sensitive federal tax, payment, and financial data. Options evaluated: AWS GovCloud, Azure Government, Google Cloud for Government.'),
          heading(2, 'Decision'),
          paragraph('AWS GovCloud (US) as the primary cloud provider, with Azure Government as secondary for specific workloads requiring Microsoft ecosystem integration (Active Directory, Power BI).'),
          heading(2, 'Consequences'),
          bulletList(
            'Positive: Broadest FedRAMP High service catalog, established IRS relationship, strong data sovereignty controls',
            'Positive: GovCloud regions are physically isolated, operated by US citizens with security clearances',
            'Negative: Vendor concentration risk — mitigated by containerized workloads portable to any Kubernetes platform',
            'Negative: Higher cost than commercial AWS — justified by compliance requirements',
          ),
        ),
      },
      {
        title: 'ADR-002: Event-Sourced Architecture for IRS Taxpayer Accounts',
        content: makeDoc(
          heading(1, 'ADR-002: Event-Sourced Architecture for IRS Taxpayer Accounts'),
          boldParagraph('Status: ', 'Accepted (2024-06-01)'),
          heading(2, 'Context'),
          paragraph('The IRS Individual Master File (IMF) is a batch-processing system that maintains taxpayer account balances. Modernization requires a real-time system that preserves complete audit history. Traditional CRUD would lose the batch-era audit trail.'),
          heading(2, 'Decision'),
          paragraph('Event-sourced architecture using Apache Kafka for the event log and PostgreSQL for materialized views. Every change to a taxpayer account is an immutable event. Current balances are projections computed from the event stream.'),
          heading(2, 'Consequences'),
          bulletList(
            'Positive: Complete, immutable audit trail satisfies Treasury Inspector General requirements',
            'Positive: Enables parallel running with legacy IMF (dual-write, compare projections)',
            'Positive: Supports temporal queries ("What was this account balance on April 15, 2024?")',
            'Negative: Higher storage costs (events never deleted) — projected 50TB/year',
            'Negative: Team requires training on event sourcing patterns — 3-month ramp-up',
          ),
        ),
      },
      {
        title: 'ADR-003: Zero-Trust Network Architecture',
        content: makeDoc(
          heading(1, 'ADR-003: Zero-Trust Network Architecture'),
          boldParagraph('Status: ', 'Accepted (2024-08-15)'),
          heading(2, 'Context'),
          paragraph('Executive Order 14028 mandates federal agencies adopt zero-trust architecture by 2027. Treasury must transition from perimeter-based security to identity-centric, microsegmented access controls.'),
          heading(2, 'Decision'),
          paragraph('Implement NIST SP 800-207 zero-trust architecture using: (1) Identity-aware proxy for all application access, (2) mTLS between all services, (3) Microsegmentation via AWS security groups and network policies, (4) Continuous authorization with risk-adaptive access controls.'),
        ),
      },
    ],
  },
  {
    title: 'Engineering Standards & Guidelines',
    content: makeDoc(
      heading(1, 'Engineering Standards & Guidelines'),
      paragraph('Mandatory standards for all Treasury software development teams. These standards align with NIST, FedRAMP, and Treasury-specific requirements.'),
    ),
    children: [
      {
        title: 'Coding Standards',
        content: makeDoc(
          heading(1, 'Treasury Coding Standards'),
          heading(2, 'Languages'),
          bulletList(
            'Backend: TypeScript (Node.js), Java 21, Python 3.12+ — approved by EARB',
            'Frontend: TypeScript, React 18+ — USWDS (US Web Design System) components required for public-facing applications',
            'Infrastructure: Terraform, AWS CDK (TypeScript) — all infrastructure must be codified',
            'Data Engineering: Python (PySpark), SQL — Delta Lake format for analytical workloads',
          ),
          heading(2, 'Security Requirements'),
          bulletList(
            'All dependencies must be scanned by Snyk/Dependabot with vulnerabilities resolved within SLA',
            'Critical/High: 48 hours. Medium: 14 days. Low: next sprint',
            'OWASP Top 10 protections mandatory. Automated SAST (SonarQube) and DAST (ZAP) in CI pipeline',
            'Secrets must use AWS Secrets Manager or SSM Parameter Store — never in code or environment variables',
            'All API endpoints require authentication. No anonymous access except public data portal',
          ),
          heading(2, 'Accessibility'),
          paragraph('All user-facing applications must meet Section 508 / WCAG 2.1 AA standards. Automated accessibility testing (axe-core) required in CI pipeline. Manual testing with screen readers (JAWS, NVDA) required before release.'),
        ),
      },
      {
        title: 'API Design Standards',
        content: makeDoc(
          heading(1, 'Treasury API Design Standards'),
          paragraph('All Treasury APIs must follow these standards to ensure interoperability and security across bureaus.'),
          heading(2, 'Requirements'),
          bulletList(
            'RESTful design with OpenAPI 3.0 specification',
            'JSON:API content type for all responses',
            'OAuth 2.0 + PKCE for external API authentication',
            'Rate limiting: 100 requests/minute for standard tier, 1000/minute for approved partners',
            'API versioning via URL path (e.g., /api/v2/payments)',
            'All APIs must be registered in the Treasury API Gateway catalog',
          ),
          heading(2, 'Data Classification'),
          paragraph('APIs serving Federal Tax Information (FTI) require additional safeguards per IRS Publication 1075. APIs serving Suspicious Activity Report (SAR) data are restricted to law enforcement with appropriate authorization.'),
        ),
      },
      {
        title: 'Incident Response Procedures',
        content: makeDoc(
          heading(1, 'Incident Response Procedures'),
          heading(2, 'Severity Levels'),
          bulletList(
            'SEV-1 (Critical): Data breach, system-wide outage affecting taxpayers/payments — Response: 15 min, C-suite notification',
            'SEV-2 (High): Major feature degradation, single bureau outage — Response: 30 min, Director notification',
            'SEV-3 (Medium): Minor feature issues, performance degradation — Response: 2 hours',
            'SEV-4 (Low): Cosmetic issues, non-critical bugs — Response: next business day',
          ),
          heading(2, 'Notification Requirements'),
          paragraph('SEV-1 incidents require notification to: Treasury CISO, Bureau CIO, US-CERT (within 1 hour per BOD 22-01), and Congressional oversight committees (within 72 hours if data breach per FISMA). All incidents logged in ServiceNow and reviewed in weekly security operations meeting.'),
        ),
      },
      {
        title: 'FedRAMP Compliance Checklist',
        content: makeDoc(
          heading(1, 'FedRAMP High Compliance Checklist'),
          paragraph('All Treasury cloud deployments must achieve FedRAMP High authorization. This checklist covers the 421 controls required for High baseline.'),
          heading(2, 'Key Control Families'),
          bulletList(
            'AC (Access Control): 25 controls — PIV authentication, least privilege, session management',
            'AU (Audit): 16 controls — Comprehensive logging, tamper-evident audit trails, 1-year retention',
            'CM (Configuration Management): 11 controls — Hardened baselines (STIG/CIS), automated scanning',
            'IA (Identification & Authentication): 12 controls — MFA for all users, certificate-based for systems',
            'SC (System & Communications Protection): 39 controls — Encryption in transit (TLS 1.3) and at rest (AES-256)',
            'SI (System & Information Integrity): 16 controls — Continuous monitoring, vulnerability scanning, patching',
          ),
          heading(2, 'Evidence Collection'),
          paragraph('Automated evidence collection via the DevSecOps pipeline. OSCAL-formatted System Security Plans (SSPs) generated from infrastructure-as-code. Continuous monitoring via AWS Security Hub and CloudTrail.'),
        ),
      },
    ],
  },
  {
    title: 'Onboarding Guide — New Engineers',
    content: makeDoc(
      heading(1, 'Onboarding Guide for New Treasury Engineers'),
      paragraph('Welcome to the Department of the Treasury\'s Office of the Chief Information Officer (OCIO). This guide will help you get set up and productive in your first two weeks.'),
      heading(2, 'Week 1'),
      bulletList(
        'Day 1: Badge pickup at Main Treasury (1500 Pennsylvania Ave NW). Meet your manager and team',
        'Day 1: IT setup — PIV card activation, laptop provisioning (Mac or Windows), VPN enrollment',
        'Day 2: Complete required training: Cybersecurity Awareness, Records Management, Privacy Act',
        'Day 3: AWS GovCloud access request (2-3 day approval). GitHub Enterprise access request',
        'Day 4: Clone team repositories, set up local development environment (see Dev Environment Setup)',
        'Day 5: Shadow a team member on a current sprint story',
      ),
      heading(2, 'Week 2'),
      bulletList(
        'Complete bureau-specific training for your assigned program',
        'Review Architecture Decision Records relevant to your team',
        'Pick up a "good first issue" from the backlog',
        'Attend sprint planning and standup meetings',
        'Schedule 1:1 with your skip-level manager',
      ),
      heading(2, 'Key Contacts'),
      bulletList(
        'Help Desk: IT-ServiceDesk@treasury.gov (x5555)',
        'Security Operations Center: SOC@treasury.gov (x5911)',
        'HR: HR-Connect@treasury.gov',
        'Building Services: facilities@treasury.gov',
      ),
    ),
  },
  {
    title: 'Development Environment Setup',
    content: makeDoc(
      heading(1, 'Development Environment Setup'),
      paragraph('Instructions for setting up your local development environment on Treasury-issued hardware.'),
      heading(2, 'Prerequisites'),
      bulletList(
        'Treasury-issued laptop with Full Disk Encryption enabled',
        'PIV card with valid certificates (check expiry with pkcs11-tool)',
        'VPN access (Zscaler Client Connector) — required for AWS and GitHub access',
        'GitHub Enterprise account (request via ServiceNow ticket)',
      ),
      heading(2, 'Required Software'),
      bulletList(
        'Node.js 20 LTS (via nvm) — Treasury approved version',
        'Docker Desktop (with GovCloud ECR credentials configured)',
        'AWS CLI v2 with SSO configured for GovCloud',
        'Terraform 1.6+ (tfenv for version management)',
        'PostgreSQL 16 (local development database)',
        'VS Code with Treasury-approved extensions (ESLint, Prettier, SonarLint)',
      ),
      heading(2, 'Repository Access'),
      paragraph('All repositories are in the github.com/USTreasury organization. Clone via SSH with your PIV card certificates configured for Git signing. All commits must be GPG-signed per Treasury policy.'),
    ),
  },
  {
    title: 'Sprint Ceremonies & Cadence',
    content: makeDoc(
      heading(1, 'Sprint Ceremonies & Cadence'),
      paragraph('All Treasury engineering teams follow a weekly sprint cadence aligned to the Department\'s fiscal calendar.'),
      heading(2, 'Weekly Schedule'),
      bulletList(
        'Monday AM: Sprint Planning — Review backlog, commit to week\'s work, update capacity',
        'Tuesday-Thursday: Execution — Daily standups at 9:15 AM ET (15 min max)',
        'Friday AM: Sprint Review — Demo completed work to stakeholders',
        'Friday PM: Retrospective — What went well, what to improve, action items',
      ),
      heading(2, 'Cross-Bureau Sync'),
      paragraph('Monthly all-hands with bureau tech leads (first Thursday). Quarterly architecture review with EARB. Annual strategic planning aligned to OMB budget cycle.'),
      heading(2, 'Ship Tool Usage'),
      paragraph('All sprint tracking, documentation, and retrospectives happen in Ship. Weekly plans due by Monday 10 AM ET. Retros due by Friday 5 PM ET. Program leads review status in the Ship dashboard every Wednesday.'),
    ),
  },
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedProduction() {
  await loadProductionSecrets();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  console.log('🏛️  Starting US Treasury production seed...');
  const dbHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'unknown';
  console.log(`   Database host: ${dbHost}`);

  try {
    // Run schema
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schema);
    console.log('✅ Schema created');

    // ========================================================================
    // WORKSPACE
    // ========================================================================
    const existingWorkspace = await pool.query(
      'SELECT id FROM workspaces WHERE name = $1',
      ['US Department of the Treasury']
    );

    let workspaceId: string;
    if (existingWorkspace.rows[0]) {
      workspaceId = existingWorkspace.rows[0].id;
      console.log('ℹ️  Workspace already exists');
    } else {
      // Sprint start ~3 months ago, aligned to Monday
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const dayOfWeek = threeMonthsAgo.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - daysToSubtract);

      const wsResult = await pool.query(
        `INSERT INTO workspaces (name, sprint_start_date)
         VALUES ($1, $2) RETURNING id`,
        ['US Department of the Treasury', threeMonthsAgo.toISOString().split('T')[0]]
      );
      workspaceId = wsResult.rows[0].id;
      console.log('✅ Workspace created: US Department of the Treasury');
    }

    // ========================================================================
    // USERS
    // ========================================================================
    const passwordHash = await bcrypt.hash('admin123', 10);
    let usersCreated = 0;

    // Create dev user first (admin)
    const devUserExists = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', ['dev@ship.local']);
    if (!devUserExists.rows[0]) {
      await pool.query(
        `INSERT INTO users (email, password_hash, name, last_workspace_id, is_super_admin)
         VALUES ($1, $2, $3, $4, true)`,
        ['dev@ship.local', passwordHash, 'Sarah Chen', workspaceId]
      );
      usersCreated++;
    } else {
      // Update dev user name to match Treasury persona
      await pool.query(
        `UPDATE users SET name = 'Sarah Chen', is_super_admin = true, last_workspace_id = $1 WHERE LOWER(email) = 'dev@ship.local'`,
        [workspaceId]
      );
    }

    // Create all team members
    for (const member of teamMembers) {
      const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [member.email]);
      if (!existing.rows[0]) {
        await pool.query(
          `INSERT INTO users (email, password_hash, name, last_workspace_id)
           VALUES ($1, $2, $3, $4)`,
          [member.email, passwordHash, member.name, workspaceId]
        );
        usersCreated++;
      }
    }

    console.log(usersCreated > 0
      ? `✅ Created ${usersCreated} users (all use password: admin123)`
      : 'ℹ️  All users already exist');

    // ========================================================================
    // WORKSPACE MEMBERSHIPS + PERSON DOCUMENTS
    // ========================================================================
    const allUsersResult = await pool.query('SELECT id, email, name FROM users');
    const emailToUserId = new Map<string, string>();
    for (const u of allUsersResult.rows) {
      emailToUserId.set(u.email, u.id);
    }

    let membershipsCreated = 0;
    let personDocsCreated = 0;

    for (const user of allUsersResult.rows) {
      // Membership
      const existingMembership = await pool.query(
        'SELECT id FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, user.id]
      );
      if (!existingMembership.rows[0]) {
        const role = user.email === 'dev@ship.local' ? 'admin' : 'member';
        await pool.query(
          `INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES ($1, $2, $3)`,
          [workspaceId, user.id, role]
        );
        membershipsCreated++;
      }

      // Person document
      const existingPerson = await pool.query(
        `SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'person' AND properties->>'user_id' = $2`,
        [workspaceId, user.id]
      );
      if (!existingPerson.rows[0]) {
        // Find role from team members list
        const memberDef = teamMembers.find(m => m.email === user.email);
        const skills = memberDef ? [memberDef.role] : [];
        await pool.query(
          `INSERT INTO documents (workspace_id, document_type, title, properties, created_by)
           VALUES ($1, 'person', $2, $3, $4)`,
          [workspaceId, user.name, JSON.stringify({
            user_id: user.id,
            email: user.email,
            skills,
            capacity_hours: 40,
          }), user.id]
        );
        personDocsCreated++;
      }
    }

    if (membershipsCreated > 0) console.log(`✅ Created ${membershipsCreated} workspace memberships`);
    if (personDocsCreated > 0) console.log(`✅ Created ${personDocsCreated} person documents`);

    // ========================================================================
    // REPORTING HIERARCHY
    // ========================================================================
    let reportsToSet = 0;
    for (const [email, managerEmail] of Object.entries(reportingHierarchy)) {
      const userId = emailToUserId.get(email);
      const managerId = emailToUserId.get(managerEmail);
      if (userId && managerId) {
        await pool.query(
          `UPDATE documents SET properties = properties || jsonb_build_object('reports_to', $1::text)
           WHERE workspace_id = $2 AND document_type = 'person' AND properties->>'user_id' = $3`,
          [managerId, workspaceId, userId]
        );
        reportsToSet++;
      }
    }
    // Also set dev@ship.local → Sarah Chen as the root (map the dev user's person doc too)
    const devUserId = emailToUserId.get('dev@ship.local');
    const sarahUserId = emailToUserId.get('sarah.chen@treasury.gov');
    if (devUserId && sarahUserId && devUserId !== sarahUserId) {
      // The dev user IS Sarah Chen in this seed, so no reports_to for root
    }
    if (reportsToSet > 0) console.log(`✅ Set reports_to for ${reportsToSet} people`);

    // ========================================================================
    // PROGRAMS
    // ========================================================================
    const programs: Array<{ id: string; prefix: string; name: string; color: string; teamUserIds: string[] }> = [];
    let programsCreated = 0;

    for (const prog of programDefinitions) {
      const existing = await pool.query(
        `SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'program' AND properties->>'prefix' = $2`,
        [workspaceId, prog.prefix]
      );

      const teamUserIds = prog.teamEmails.map(e => emailToUserId.get(e)).filter(Boolean) as string[];

      if (existing.rows[0]) {
        programs.push({ id: existing.rows[0].id, prefix: prog.prefix, name: prog.name, color: prog.color, teamUserIds });
      } else {
        const result = await pool.query(
          `INSERT INTO documents (workspace_id, document_type, title, properties)
           VALUES ($1, 'program', $2, $3) RETURNING id`,
          [workspaceId, prog.name, JSON.stringify({ prefix: prog.prefix, color: prog.color })]
        );
        programs.push({ id: result.rows[0].id, prefix: prog.prefix, name: prog.name, color: prog.color, teamUserIds });
        programsCreated++;
      }
    }

    console.log(programsCreated > 0 ? `✅ Created ${programsCreated} programs` : 'ℹ️  All programs already exist');

    // ========================================================================
    // PROJECTS
    // ========================================================================
    const projects: Array<{ id: string; programId: string; programPrefix: string; title: string; projectIndex: number }> = [];
    let projectsCreated = 0;

    for (const program of programs) {
      const defs = projectDefinitions[program.prefix] || [];
      for (let pi = 0; pi < defs.length; pi++) {
        const def = defs[pi]!;
        const projectTitle = def.name;

        const existing = await pool.query(
          `SELECT d.id FROM documents d
           JOIN document_associations da ON da.document_id = d.id
             AND da.related_id = $3 AND da.relationship_type = 'program'
           WHERE d.workspace_id = $1 AND d.document_type = 'project' AND d.title = $2`,
          [workspaceId, projectTitle, program.id]
        );

        if (existing.rows[0]) {
          projects.push({ id: existing.rows[0].id, programId: program.id, programPrefix: program.prefix, title: projectTitle, projectIndex: pi });
        } else {
          const ownerIdx = pi % program.teamUserIds.length;
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + (pi + 2) * 14); // 2-8 weeks out

          const result = await pool.query(
            `INSERT INTO documents (workspace_id, document_type, title, properties)
             VALUES ($1, 'project', $2, $3) RETURNING id`,
            [workspaceId, projectTitle, JSON.stringify({
              color: def.color,
              emoji: def.emoji,
              owner_id: program.teamUserIds[ownerIdx],
              impact: def.impact,
              confidence: def.confidence,
              ease: def.ease,
              plan: def.plan,
              monetary_impact_expected: def.monetary_impact_expected,
              target_date: targetDate.toISOString().split('T')[0],
            })]
          );

          await createAssociation(pool, result.rows[0].id, program.id, 'program');
          projects.push({ id: result.rows[0].id, programId: program.id, programPrefix: program.prefix, title: projectTitle, projectIndex: pi });
          projectsCreated++;
        }
      }
    }

    console.log(projectsCreated > 0 ? `✅ Created ${projectsCreated} projects` : 'ℹ️  All projects already exist');

    // ========================================================================
    // SPRINTS (WEEKS)
    // ========================================================================
    const wsResult = await pool.query('SELECT sprint_start_date FROM workspaces WHERE id = $1', [workspaceId]);
    const sprintStartDate = new Date(wsResult.rows[0].sprint_start_date);
    const today = new Date();
    const daysSinceStart = Math.floor((today.getTime() - sprintStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentSprintNumber = Math.max(1, Math.floor(daysSinceStart / 7) + 1);

    // Get person doc IDs for allocation
    const personDocsResult = await pool.query(
      `SELECT d.id as person_doc_id, d.properties->>'user_id' as user_id FROM documents d
       WHERE d.workspace_id = $1 AND d.document_type = 'person'`,
      [workspaceId]
    );
    const userIdToPersonDocId = new Map<string, string>();
    for (const row of personDocsResult.rows) {
      if (row.user_id) userIdToPersonDocId.set(row.user_id, row.person_doc_id);
    }

    const sprints: Array<{ id: string; programId: string; programPrefix: string; projectId: string; number: number }> = [];
    let sprintsCreated = 0;

    for (const program of programs) {
      const programProjects = projects.filter(p => p.programId === program.id);
      if (programProjects.length === 0) continue;

      let projectIdx = 0;
      for (let sprintNum = currentSprintNumber - 4; sprintNum <= currentSprintNumber + 3; sprintNum++) {
        if (sprintNum < 1) continue;

        const project = programProjects[projectIdx % programProjects.length]!;
        const ownerIdx = (sprintNum - 1) % program.teamUserIds.length;
        const ownerId = program.teamUserIds[ownerIdx]!;

        const existing = await pool.query(
          `SELECT d.id FROM documents d
           JOIN document_associations da ON da.document_id = d.id
             AND da.related_id = $2 AND da.relationship_type = 'program'
           WHERE d.workspace_id = $1 AND d.document_type = 'sprint'
             AND (d.properties->>'sprint_number')::int = $3`,
          [workspaceId, program.id, sprintNum]
        );

        if (existing.rows[0]) {
          sprints.push({ id: existing.rows[0].id, programId: program.id, programPrefix: program.prefix, projectId: project.id, number: sprintNum });
        } else {
          const sprintOffset = sprintNum - currentSprintNumber;
          let sprintStatus: string | undefined;
          if (sprintOffset < 0) sprintStatus = 'completed';
          else if (sprintOffset === 0) sprintStatus = 'active';

          // Confidence based on timing
          let baseConfidence = 80;
          if (sprintOffset < 0) baseConfidence = 95;
          else if (sprintOffset === 0) baseConfidence = 75;
          else if (sprintOffset === 1) baseConfidence = 60;
          else baseConfidence = 40;

          const assigneePersonDocIds = program.teamUserIds
            .slice(0, 3)
            .map(uid => userIdToPersonDocId.get(uid))
            .filter(Boolean);

          const sprintGoals = [
            'Deliver filing flow improvements and resolve critical validation bugs',
            'Complete data pipeline integration and pass security review',
            'Ship API endpoints and begin performance optimization',
            'Finalize UI components and address accessibility findings',
            'Deploy infrastructure updates and run load testing',
            'Complete analytics dashboards and documentation',
            'Integrate cross-bureau data feeds and validate accuracy',
            'Ship compliance reporting features and audit trail improvements',
          ];

          const result = await pool.query(
            `INSERT INTO documents (workspace_id, document_type, title, properties)
             VALUES ($1, 'sprint', $2, $3) RETURNING id`,
            [workspaceId, `Week ${sprintNum}`, JSON.stringify({
              sprint_number: sprintNum,
              owner_id: ownerId,
              project_id: project.id,
              assignee_ids: assigneePersonDocIds,
              plan: sprintGoals[sprintNum % sprintGoals.length],
              confidence: baseConfidence + (Math.random() * 10 - 5),
              ...(sprintStatus && { status: sprintStatus }),
            })]
          );

          await createAssociation(pool, result.rows[0].id, project.id, 'project');
          await createAssociation(pool, result.rows[0].id, program.id, 'program');

          sprints.push({ id: result.rows[0].id, programId: program.id, programPrefix: program.prefix, projectId: project.id, number: sprintNum });
          sprintsCreated++;
        }
        projectIdx++;
      }
    }

    console.log(sprintsCreated > 0 ? `✅ Created ${sprintsCreated} weeks` : 'ℹ️  All weeks already exist');

    // ========================================================================
    // ISSUES
    // ========================================================================
    let issuesCreated = 0;

    // Get max ticket numbers per program
    const maxTickets: Record<string, number> = {};
    for (const program of programs) {
      const maxResult = await pool.query(
        `SELECT COALESCE(MAX(d.ticket_number), 0) as max_ticket
         FROM documents d
         JOIN document_associations da ON da.document_id = d.id
           AND da.related_id = $2 AND da.relationship_type = 'program'
         WHERE d.workspace_id = $1 AND d.document_type = 'issue'`,
        [workspaceId, program.id]
      );
      maxTickets[program.id] = maxResult.rows[0].max_ticket;
    }

    for (const program of programs) {
      const issues = issueDefinitions[program.prefix] || [];
      const programProjects = projects.filter(p => p.programId === program.id);

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i]!;
        const assigneeId = program.teamUserIds[i % program.teamUserIds.length]!;

        // Find sprint
        let sprintId: string | null = null;
        if (issue.sprintOffset !== null) {
          const targetNum = currentSprintNumber + issue.sprintOffset;
          const sprint = sprints.find(s => s.programId === program.id && s.number === targetNum);
          sprintId = sprint?.id || null;
        }

        // Find project
        const project = programProjects.find(p => p.projectIndex === issue.projectIndex);
        const projectId = project?.id;

        // Check if exists
        const existing = await pool.query(
          `SELECT d.id FROM documents d
           JOIN document_associations da ON da.document_id = d.id
             AND da.related_id = $2 AND da.relationship_type = 'program'
           WHERE d.workspace_id = $1 AND d.title = $3 AND d.document_type = 'issue'`,
          [workspaceId, program.id, issue.title]
        );

        if (!existing.rows[0]) {
          maxTickets[program.id]!++;
          const issueResult = await pool.query(
            `INSERT INTO documents (workspace_id, document_type, title, properties, ticket_number)
             VALUES ($1, 'issue', $2, $3, $4) RETURNING id`,
            [workspaceId, issue.title, JSON.stringify({
              state: issue.state,
              priority: issue.priority,
              source: 'internal',
              assignee_id: assigneeId,
              estimate: issue.estimate,
              feedback_status: null,
              rejection_reason: null,
            }), maxTickets[program.id]]
          );

          const issueId = issueResult.rows[0].id;
          await createAssociation(pool, issueId, program.id, 'program');
          if (sprintId) {
            await createAssociation(pool, issueId, sprintId, 'sprint');
          }
          if (projectId) {
            await createAssociation(pool, issueId, projectId, 'project');
          }

          issuesCreated++;
        }
      }
    }

    console.log(issuesCreated > 0 ? `✅ Created ${issuesCreated} issues` : 'ℹ️  All issues already exist');

    // ========================================================================
    // WIKI DOCUMENTS
    // ========================================================================
    let wikiDocsCreated = 0;

    // Welcome document first
    const existingWelcome = await pool.query(
      'SELECT id FROM documents WHERE workspace_id = $1 AND document_type = $2 AND title = $3',
      [workspaceId, 'wiki', WELCOME_DOCUMENT_TITLE]
    );
    if (!existingWelcome.rows[0]) {
      await pool.query(
        `INSERT INTO documents (workspace_id, document_type, title, content, position)
         VALUES ($1, 'wiki', $2, $3, 0)`,
        [workspaceId, WELCOME_DOCUMENT_TITLE, JSON.stringify(WELCOME_DOCUMENT_CONTENT)]
      );
      wikiDocsCreated++;
    }

    // Recursive wiki creation
    async function createWikiTree(docs: typeof wikiDocuments, parentId: string | null, position: number) {
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]!;
        const existing = await pool.query(
          `SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'wiki' AND title = $2
           ${parentId ? 'AND parent_id = $3' : 'AND parent_id IS NULL'}`,
          parentId ? [workspaceId, doc.title, parentId] : [workspaceId, doc.title]
        );

        let docId: string;
        if (existing.rows[0]) {
          docId = existing.rows[0].id;
        } else {
          const result = await pool.query(
            `INSERT INTO documents (workspace_id, document_type, title, content, parent_id, position)
             VALUES ($1, 'wiki', $2, $3, $4, $5) RETURNING id`,
            [workspaceId, doc.title, JSON.stringify(doc.content), parentId, position + i + 1]
          );
          docId = result.rows[0].id;
          wikiDocsCreated++;
        }

        if ('children' in doc && doc.children) {
          await createWikiTree(doc.children as typeof wikiDocuments, docId, 0);
        }
      }
    }

    await createWikiTree(wikiDocuments, null, 1);
    console.log(wikiDocsCreated > 0 ? `✅ Created ${wikiDocsCreated} wiki documents` : 'ℹ️  All wiki documents already exist');

    // ========================================================================
    // WEEKLY PLANS & RETROS
    // ========================================================================
    let weeklyPlansCreated = 0;
    let weeklyRetrosCreated = 0;

    const treasuryPlanContent = [
      ['Review ATO documentation for new cloud services', 'Complete sprint stories for filing flow', 'Attend bureau security review meeting', 'Update technical design document'],
      ['Implement API endpoint changes per EARB feedback', 'Run STIG compliance scan on new deployments', 'Code review for cross-bureau integration', 'Prepare demo for Friday sprint review'],
      ['Debug payment processing edge cases', 'Write integration tests for new data pipeline', 'Attend FinCEN data quality working group', 'Update runbook for production deployment'],
      ['Complete accessibility remediation for Section 508', 'Implement MFA enrollment improvements', 'Review and merge team PRs', 'Update project risk register'],
      ['Deploy staging environment updates', 'Conduct performance testing for screening engine', 'Document API changes for partner institutions', 'Attend OCIO all-hands meeting'],
    ];

    const treasuryRetroContent = [
      ['Completed ATO documentation review — 3 findings addressed', 'Filing flow sprint stories delivered on schedule', 'Security review passed with no critical findings', 'Technical design doc approved by EARB'],
      ['API endpoints deployed per EARB feedback — all tests passing', 'STIG scan: 0 critical, 2 medium findings (in remediation)', 'Cross-bureau integration code merged', 'Sprint demo received positive stakeholder feedback'],
      ['Payment edge cases resolved — 4 bugs fixed', 'Integration tests cover 87% of data pipeline', 'Data quality framework improvements merged', 'Production deployment successful with zero downtime'],
      ['Section 508 audit: 12 of 15 findings remediated', 'MFA enrollment completion rate improved from 72% to 89%', 'Reviewed and merged 6 PRs', 'Risk register updated — 2 risks mitigated'],
      ['Staging environment matches production config', 'Screening engine: 280ms → 195ms latency improvement', 'API documentation published for 3 partner banks', 'Shared team updates at OCIO all-hands'],
    ];

    function makePlanContent(items: string[]) {
      return makeDoc(
        heading(2, 'What I plan to accomplish this week'),
        bulletList(...items),
      );
    }

    function makeRetroContent(items: string[]) {
      return makeDoc(
        heading(2, 'What I delivered this week'),
        bulletList(...items),
      );
    }

    for (const program of programs) {
      const programSprints = sprints.filter(s => s.programId === program.id);

      for (const sprint of programSprints) {
        const sprintOffset = sprint.number - currentSprintNumber;

        for (let ti = 0; ti < Math.min(program.teamUserIds.length, 3); ti++) {
          const userId = program.teamUserIds[ti]!;
          const personDocId = userIdToPersonDocId.get(userId);
          if (!personDocId) continue;

          const contentIdx = (sprint.number + ti) % treasuryPlanContent.length;

          // Past sprints: plan + retro
          if (sprintOffset < 0) {
            // Skip some for realism
            if ((sprint.number + ti) % 7 === 3) continue;

            const existingPlan = await pool.query(
              `SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'weekly_plan'
               AND (properties->>'person_id') = $2 AND (properties->>'week_number')::int = $3`,
              [workspaceId, personDocId, sprint.number]
            );
            if (!existingPlan.rows[0]) {
              await pool.query(
                `INSERT INTO documents (workspace_id, document_type, title, content, properties, visibility, created_by)
                 VALUES ($1, 'weekly_plan', $2, $3, $4, 'workspace', $5)`,
                [workspaceId, `Week ${sprint.number} Plan`, JSON.stringify(makePlanContent(treasuryPlanContent[contentIdx]!)),
                  JSON.stringify({ person_id: personDocId, project_id: sprint.projectId, week_number: sprint.number, submitted_at: new Date().toISOString() }),
                  userId]
              );
              weeklyPlansCreated++;
            }

            if ((sprint.number + ti) % 6 !== 2) {
              const existingRetro = await pool.query(
                `SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'weekly_retro'
                 AND (properties->>'person_id') = $2 AND (properties->>'week_number')::int = $3`,
                [workspaceId, personDocId, sprint.number]
              );
              if (!existingRetro.rows[0]) {
                await pool.query(
                  `INSERT INTO documents (workspace_id, document_type, title, content, properties, visibility, created_by)
                   VALUES ($1, 'weekly_retro', $2, $3, $4, 'workspace', $5)`,
                  [workspaceId, `Week ${sprint.number} Retro`, JSON.stringify(makeRetroContent(treasuryRetroContent[contentIdx]!)),
                    JSON.stringify({ person_id: personDocId, project_id: sprint.projectId, week_number: sprint.number, submitted_at: new Date().toISOString() }),
                    userId]
                );
                weeklyRetrosCreated++;
              }
            }
          }

          // Current sprint: plans only
          if (sprintOffset === 0 && (sprint.number + ti) % 3 !== 0) {
            const existingPlan = await pool.query(
              `SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'weekly_plan'
               AND (properties->>'person_id') = $2 AND (properties->>'week_number')::int = $3`,
              [workspaceId, personDocId, sprint.number]
            );
            if (!existingPlan.rows[0]) {
              await pool.query(
                `INSERT INTO documents (workspace_id, document_type, title, content, properties, visibility, created_by)
                 VALUES ($1, 'weekly_plan', $2, $3, $4, 'workspace', $5)`,
                [workspaceId, `Week ${sprint.number} Plan`, JSON.stringify(makePlanContent(treasuryPlanContent[contentIdx]!)),
                  JSON.stringify({ person_id: personDocId, project_id: sprint.projectId, week_number: sprint.number, submitted_at: new Date().toISOString() }),
                  userId]
              );
              weeklyPlansCreated++;
            }
          }
        }
      }
    }

    if (weeklyPlansCreated > 0) console.log(`✅ Created ${weeklyPlansCreated} weekly plans`);
    if (weeklyRetrosCreated > 0) console.log(`✅ Created ${weeklyRetrosCreated} weekly retros`);

    // ========================================================================
    // SPRINT REVIEWS (for past sprints)
    // ========================================================================
    let reviewsCreated = 0;
    const pastSprints = sprints.filter(s => s.number < currentSprintNumber);

    for (const sprint of pastSprints) {
      const existingReview = await pool.query(
        `SELECT d.id FROM documents d
         JOIN document_associations da ON da.document_id = d.id
           AND da.related_id = $2 AND da.relationship_type = 'sprint'
         WHERE d.workspace_id = $1 AND d.document_type = 'weekly_review'`,
        [workspaceId, sprint.id]
      );

      if (!existingReview.rows[0]) {
        const program = programs.find(p => p.id === sprint.programId);
        const reviewContent = makeDoc(
          heading(2, 'What went well'),
          bulletList(
            `${program?.name || 'Team'} delivered on sprint commitments`,
            'Cross-bureau coordination improved',
            'Zero security incidents during deployment',
          ),
          heading(2, 'What could be improved'),
          bulletList(
            'Earlier engagement with compliance team on new features',
            'Better estimation for infrastructure tasks',
            'More frequent check-ins with stakeholder bureaus',
          ),
        );

        const ownerId = program?.teamUserIds[sprint.number % (program?.teamUserIds.length || 1)] || program?.teamUserIds[0];
        const result = await pool.query(
          `INSERT INTO documents (workspace_id, document_type, title, content, created_by)
           VALUES ($1, 'weekly_review', $2, $3, $4) RETURNING id`,
          [workspaceId, `Week ${sprint.number} Review`, JSON.stringify(reviewContent), ownerId]
        );

        await createAssociation(pool, result.rows[0].id, sprint.id, 'sprint');
        reviewsCreated++;
      }
    }

    if (reviewsCreated > 0) console.log(`✅ Created ${reviewsCreated} week reviews`);

    // ========================================================================
    // STANDUPS
    // ========================================================================
    let standupsCreated = 0;

    for (const program of programs) {
      const recentSprints = sprints.filter(
        s => s.programId === program.id && s.number >= currentSprintNumber - 1 && s.number <= currentSprintNumber
      );

      for (const sprint of recentSprints) {
        const existingStandups = await pool.query(
          `SELECT d.id FROM documents d
           JOIN document_associations da ON da.document_id = d.id
             AND da.related_id = $2 AND da.relationship_type = 'sprint'
           WHERE d.workspace_id = $1 AND d.document_type = 'standup'`,
          [workspaceId, sprint.id]
        );

        if (existingStandups.rows.length === 0) {
          const standupAuthors = program.teamUserIds.slice(0, 2);
          const standupMessages = [
            makeDoc(
              paragraph('Yesterday: Completed API integration testing with partner bureau systems.'),
              paragraph('Today: Working on deployment preparation and documentation updates.'),
              paragraph('Blockers: Waiting on ATO approval for new cloud services.'),
            ),
            makeDoc(
              paragraph('Yesterday: Code review and security scan remediation.'),
              paragraph('Today: Implementing feedback from EARB architecture review.'),
              paragraph('Blockers: None — on track for Friday demo.'),
            ),
          ];

          for (let i = 0; i < standupAuthors.length; i++) {
            const authorId = standupAuthors[i]!;
            const authorUser = allUsersResult.rows.find((u: { id: string }) => u.id === authorId);

            const result = await pool.query(
              `INSERT INTO documents (workspace_id, document_type, title, content, created_by, properties, created_at)
               VALUES ($1, 'standup', $2, $3, $4, $5, NOW() - INTERVAL '${i} days') RETURNING id`,
              [workspaceId, `Standup - ${authorUser?.name || 'Unknown'}`,
                JSON.stringify(standupMessages[i % standupMessages.length]),
                authorId,
                JSON.stringify({ author_id: authorId })]
            );

            await createAssociation(pool, result.rows[0].id, sprint.id, 'sprint');
            standupsCreated++;
          }
        }
      }
    }

    if (standupsCreated > 0) console.log(`✅ Created ${standupsCreated} standups`);

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('');
    console.log('🏛️  US Treasury production seed complete!');
    console.log('');
    console.log('Login credentials:');
    console.log('  Email: dev@ship.local');
    console.log('  Password: admin123');
    console.log('  Role: Sarah Chen, Deputy CIO');
    console.log('');
    console.log(`Programs: ${programs.length}`);
    console.log(`Projects: ${projects.length}`);

    // Count totals
    const totalIssues = await pool.query(
      `SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND document_type = 'issue'`,
      [workspaceId]
    );
    const totalWiki = await pool.query(
      `SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND document_type = 'wiki'`,
      [workspaceId]
    );
    const totalPeople = await pool.query(
      `SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND document_type = 'person'`,
      [workspaceId]
    );

    console.log(`Issues: ${totalIssues.rows[0].count}`);
    console.log(`Wiki pages: ${totalWiki.rows[0].count}`);
    console.log(`People: ${totalPeople.rows[0].count}`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedProduction();
