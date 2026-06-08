import type { KnowledgeNodeType } from '@prisma/client';

import type { ConfidenceLevel, WeaknessLevel } from './knowledgeGraph.scoring';

// Shared response shapes for the Knowledge Graph APIs (PDF §9).

export interface GraphNode {
  id: number;
  name: string;
  type: KnowledgeNodeType;
  subjectId: number | null;
  chapterId: number | null;
  parentId: number | null;
  orderIndex: number;
  masteryScore: number;
  accuracyRate: number;
  weaknessLevel: WeaknessLevel;
  confidence: ConfidenceLevel;
  attemptCount: number;
  correctCount: number;
  avgTimeSec: number | null;
  /** ISO timestamp of the most recent answer for this node (null = never). */
  lastAttemptAt: string | null;
  /** Whole days since last practised (null = never). */
  daysSinceLastPractice: number | null;
  /** True when measured but idle past the spaced-review threshold (PDF §8). */
  stale: boolean;
}

export interface GraphEdge {
  from: number;
  to: number;
  type: 'parent-child';
}

export interface GraphSummary {
  overallMastery: number;
  totalNodes: number;
  attemptedNodes: number;
  strongCount: number;
  goodCount: number;
  mediumCount: number;
  weakCount: number;
  criticalCount: number;
}

// Stable reason codes for recommendations (PDF Appendix "reason codes").
export type RecommendationReasonCode =
  | 'LOW_MASTERY'
  | 'LOW_CONFIDENCE'
  | 'PREREQ_GAP'
  | 'STALE_MASTERY';

export interface Recommendation {
  nodeId: number;
  name: string;
  type: KnowledgeNodeType;
  subjectId: number | null;
  masteryScore: number;
  reason: string;
  reasonCode: RecommendationReasonCode;
  priority: 'high' | 'medium';
  confidence: ConfidenceLevel;
  evidenceCount: number;
  /** For PREREQ_GAP: the weaker prerequisite the student should study first. */
  prerequisite?: { nodeId: number; name: string; masteryScore: number } | null;
}

export interface StudentGraphResponse {
  student: { id: number; fullName: string };
  summary: GraphSummary;
  nodes: GraphNode[];
  edges: GraphEdge[];
  recommendations: Recommendation[];
}

export type RelationType =
  | 'PART_OF'
  | 'PREREQUISITE_OF'
  | 'RELATED_TO'
  | 'MISCONCEPTION_FOR';

export interface RelationDTO {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  fromName: string;
  toName: string;
  relationType: RelationType;
  weight: number;
  source: string;
  note: string | null;
}

/** One step in a prerequisite-ordered learning path (PDF §9 "Learning path"). */
export interface LearningPathStep {
  nodeId: number;
  name: string;
  type: KnowledgeNodeType;
  masteryScore: number;
  weaknessLevel: WeaknessLevel;
  confidence: ConfidenceLevel;
  attemptCount: number;
  isTarget: boolean;
  needsWork: boolean;
}

export interface LearningPathResponse {
  target: { nodeId: number; name: string } | null;
  steps: LearningPathStep[];
}

// ─── Package C: governance + quality dashboard ─────────

export interface NodeAlias {
  id: number;
  alias: string;
  source: string;
}

export interface QualityReport {
  totals: {
    nodes: number;
    relations: number;
    questions: number;
    mappedQuestions: number;
    coverage: number; // % of questions mapped to ≥1 node
  };
  unmappedQuestions: { count: number; sample: { id: number; content: string }[] };
  orphanNodes: { count: number; sample: { id: number; name: string; type: string }[] };
  duplicateCandidates: { name: string; nodeIds: number[] }[];
  lowConfidenceMappings: number;
  overMappedQuestions: { count: number; sample: { questionId: number; skillCount: number }[] };
  thinSkillNodes: { count: number; sample: { id: number; name: string; questionCount: number }[] };
}
