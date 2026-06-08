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
