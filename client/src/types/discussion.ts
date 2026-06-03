export type DiscussionScope = 'CLASS' | 'GLOBAL';
export type DiscussionType = 'ANNOUNCEMENT' | 'DISCUSSION';
export type DiscussionAttachmentType = 'LINK' | 'FILE' | 'IMAGE' | 'VIDEO';

export interface DiscussionAuthor {
  id: number;
  fullName: string | null;
  username: string;
  role: string;
  avatar?: string | null;
}

export interface DiscussionClass {
  id: number;
  name: string;
  gradeLevel: number;
}

export interface DiscussionReply {
  id: number;
  discussionId: number;
  authorId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: DiscussionAuthor;
  attachments?: DiscussionAttachment[];
}

export interface DiscussionAttachment {
  id: number;
  discussionId: number;
  replyId: number | null;
  uploaderId: number;
  type: DiscussionAttachmentType;
  url: string;
  title: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
}

export interface Discussion {
  id: number;
  scope: DiscussionScope;
  type: DiscussionType;
  classId: number | null;
  authorId: number;
  title: string;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  author: DiscussionAuthor;
  class: DiscussionClass | null;
  attachments?: DiscussionAttachment[];
  _count?: { replies: number };
  replies?: DiscussionReply[];
}

export interface DiscussionListResponse {
  data: Discussion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListDiscussionsParams {
  scope?: DiscussionScope;
  type?: DiscussionType;
  classId?: number;
  search?: string;
  authorId?: number;
  page?: number;
  limit?: number;
}

export interface CreateDiscussionPayload {
  scope: DiscussionScope;
  type: DiscussionType;
  classId?: number;
  title: string;
  content: string;
  links?: Array<{ url: string; title?: string }>;
  files?: File[];
}

export interface UpdateDiscussionPayload {
  title?: string;
  content?: string;
  type?: DiscussionType;
  isPinned?: boolean;
  isLocked?: boolean;
}
