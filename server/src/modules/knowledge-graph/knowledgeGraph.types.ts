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

export interface Recommendation {
  nodeId: number;
  name: string;
  type: KnowledgeNodeType;
  subjectId: number | null;
  masteryScore: number;
  reason: string;
  priority: 'high' | 'medium';
}

export interface StudentGraphResponse {
  student: { id: number; fullName: string };
  summary: GraphSummary;
  nodes: GraphNode[];
  edges: GraphEdge[];
  recommendations: Recommendation[];
}
