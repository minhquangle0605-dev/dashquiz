import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';

// ═══════════════════════════════════════════════════
// TYPES (mirror server knowledgeGraph.types.ts)
// ═══════════════════════════════════════════════════

export type KnowledgeNodeType = 'SUBJECT' | 'CHAPTER' | 'SKILL' | 'SUBSKILL';
export type WeaknessLevel = 'critical' | 'weak' | 'medium' | 'good' | 'strong' | 'unknown';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

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
  lastAttemptAt: string | null;
  daysSinceLastPractice: number | null;
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
  prerequisite?: { nodeId: number; name: string; masteryScore: number } | null;
}

export type RelationType = 'PART_OF' | 'PREREQUISITE_OF' | 'RELATED_TO' | 'MISCONCEPTION_FOR';

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

export interface StudentGraphResponse {
  student: { id: number; fullName: string };
  summary: GraphSummary;
  nodes: GraphNode[];
  edges: GraphEdge[];
  recommendations: Recommendation[];
}

export interface ClassGraphResponse {
  class: { id: number; name: string; gradeLevel: number; subjectId: number; subjectName: string };
  subjectId: number;
  students: { id: number; fullName: string }[];
  nodes: { id: number; name: string; type: KnowledgeNodeType }[];
  cells: {
    studentId: number;
    nodeId: number;
    masteryScore: number;
    weaknessLevel: WeaknessLevel;
    attemptCount: number;
  }[];
}

export interface ClassWeakNode {
  nodeId: number;
  name: string;
  type: string;
  avgMastery: number;
  studentsWithData: number;
  weakStudents: number;
}

export interface AdminKnowledgeNode {
  id: number;
  name: string;
  description: string | null;
  type: KnowledgeNodeType;
  subjectId: number | null;
  chapterId: number | null;
  parentId: number | null;
  orderIndex: number;
  questionCount: number;
  childCount: number;
  aliasCount: number;
}

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
    coverage: number;
  };
  unmappedQuestions: { count: number; sample: { id: number; content: string }[] };
  orphanNodes: { count: number; sample: { id: number; name: string; type: string }[] };
  duplicateCandidates: { name: string; nodeIds: number[] }[];
  lowConfidenceMappings: number;
  overMappedQuestions: { count: number; sample: { questionId: number; skillCount: number }[] };
  thinSkillNodes: { count: number; sample: { id: number; name: string; questionCount: number }[] };
}

// ═══════════════════════════════════════════════════
// STUDENT
// ═══════════════════════════════════════════════════

export async function getMyKnowledgeGraph(subjectId?: number): Promise<StudentGraphResponse> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.STUDENT, { params });
  return data.data;
}

export async function getMyRecommendations(subjectId?: number): Promise<Recommendation[]> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.STUDENT_RECOMMENDATIONS, { params });
  return data.data;
}

export async function getMyLearningPath(targetNodeId: number): Promise<LearningPathResponse> {
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.STUDENT_PATH, {
    params: { targetNodeId },
  });
  return data.data;
}

export async function generatePracticeFromNode(
  nodeId: number,
  questionCount?: number,
): Promise<{ examId: number; title: string; totalQuestions: number }> {
  const { data } = await api.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.STUDENT_PRACTICE, {
    nodeId,
    questionCount,
  });
  return data.data;
}

// ═══════════════════════════════════════════════════
// TEACHER
// ═══════════════════════════════════════════════════

export async function getStudentKnowledgeGraph(
  studentId: number,
  subjectId?: number,
): Promise<StudentGraphResponse> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.TEACHER_STUDENT(studentId), { params });
  return data.data;
}

export async function getClassKnowledgeGraph(
  classId: number,
  subjectId?: number,
): Promise<ClassGraphResponse> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.TEACHER_CLASS(classId), { params });
  return data.data;
}

export async function getClassWeakNodes(
  classId: number,
  subjectId?: number,
): Promise<ClassWeakNode[]> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.TEACHER_CLASS_WEAK(classId), { params });
  return data.data;
}

export async function assignClassPractice(
  classId: number,
  nodeId: number,
  questionCount?: number,
): Promise<{ examId: number; title: string; totalQuestions: number; classId: number }> {
  const { data } = await api.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.TEACHER_CLASS_PRACTICE(classId), {
    nodeId,
    questionCount,
  });
  return data.data;
}

// ═══════════════════════════════════════════════════
// PARENT (read-only view of a linked child's graph)
// ═══════════════════════════════════════════════════

export async function getChildKnowledgeGraph(
  childId: number,
  subjectId?: number,
): Promise<StudentGraphResponse> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.PARENT.CHILD_KNOWLEDGE_GRAPH(childId), { params });
  return data.data;
}

export async function getChildLearningPath(
  childId: number,
  targetNodeId: number,
): Promise<LearningPathResponse> {
  const { data } = await api.get(API_ENDPOINTS.PARENT.CHILD_KNOWLEDGE_GRAPH_PATH(childId), {
    params: { targetNodeId },
  });
  return data.data;
}

// ═══════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════

export async function getAdminKnowledgeNodes(subjectId?: number): Promise<AdminKnowledgeNode[]> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_NODES, { params });
  return data.data;
}

export async function autogenerateKnowledgeNodes(): Promise<{
  subjects: number;
  chapters: number;
  skills: number;
  links: number;
}> {
  const { data } = await api.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_AUTOGENERATE);
  return data.data;
}

export async function recalculateAllMastery(): Promise<{ students: number }> {
  const { data } = await api.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_RECALCULATE);
  return data.data;
}

export async function updateKnowledgeNode(
  id: number,
  body: { name?: string; description?: string | null; orderIndex?: number },
): Promise<AdminKnowledgeNode> {
  const { data } = await api.patch(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_NODE_BY_ID(id), body);
  return data.data;
}

export async function deleteKnowledgeNode(id: number): Promise<{ id: number }> {
  const { data } = await api.delete(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_NODE_BY_ID(id));
  return data.data;
}

// ─── Relations (Package B) ─────────────────────────

export async function getKnowledgeRelations(params?: {
  nodeId?: number;
  relationType?: RelationType;
}): Promise<RelationDTO[]> {
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_RELATIONS, { params });
  return data.data;
}

export async function createKnowledgeRelation(body: {
  fromNodeId: number;
  toNodeId: number;
  relationType: RelationType;
  weight?: number;
  note?: string | null;
}): Promise<RelationDTO> {
  const { data } = await api.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_RELATIONS, body);
  return data.data;
}

export async function deleteKnowledgeRelation(id: number): Promise<{ id: number }> {
  const { data } = await api.delete(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_RELATION_BY_ID(id));
  return data.data;
}

export async function seedPartOfRelations(): Promise<{ created: number }> {
  const { data } = await api.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_RELATIONS_SEED);
  return data.data;
}

// ─── Governance (Package C) ────────────────────────

export async function getQualityReport(): Promise<QualityReport> {
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_QUALITY);
  return data.data;
}

export async function getNodeAliases(nodeId: number): Promise<NodeAlias[]> {
  const { data } = await api.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_NODE_ALIASES(nodeId));
  return data.data;
}

export async function addNodeAlias(nodeId: number, alias: string): Promise<NodeAlias> {
  const { data } = await api.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_NODE_ALIASES(nodeId), {
    alias,
  });
  return data.data;
}

export async function deleteNodeAlias(aliasId: number): Promise<{ id: number }> {
  const { data } = await api.delete(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_ALIAS_BY_ID(aliasId));
  return data.data;
}

export async function mergeKnowledgeNode(
  sourceId: number,
  targetNodeId: number,
): Promise<{ merged: number; into: number }> {
  const { data } = await api.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.ADMIN_NODE_MERGE(sourceId), {
    targetNodeId,
  });
  return data.data;
}
