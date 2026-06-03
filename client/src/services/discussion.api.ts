import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type {
  Discussion,
  DiscussionReply,
  DiscussionListResponse,
  ListDiscussionsParams,
  CreateDiscussionPayload,
  UpdateDiscussionPayload,
} from '@/types/discussion';

function discussionFormData(payload: CreateDiscussionPayload): FormData | CreateDiscussionPayload {
  if ((payload.files?.length ?? 0) === 0) return payload;

  const formData = new FormData();
  formData.append('scope', payload.scope);
  formData.append('type', payload.type);
  if (payload.classId !== undefined) formData.append('classId', String(payload.classId));
  formData.append('title', payload.title);
  formData.append('content', payload.content);
  if (payload.links?.length) formData.append('links', JSON.stringify(payload.links));
  payload.files?.forEach((file) => formData.append('attachments', file));
  return formData;
}

function replyFormData(
  content: string,
  links: Array<{ url: string; title?: string }> = [],
  files: File[] = [],
): FormData | { content: string; links?: Array<{ url: string; title?: string }> } {
  if (files.length === 0) {
    return { content, ...(links.length ? { links } : {}) };
  }

  const formData = new FormData();
  formData.append('content', content);
  if (links.length) formData.append('links', JSON.stringify(links));
  files.forEach((file) => formData.append('attachments', file));
  return formData;
}

export async function listDiscussions(
  params: ListDiscussionsParams = {},
): Promise<DiscussionListResponse> {
  const { data } = await api.get(API_ENDPOINTS.DISCUSSIONS.BASE, { params });
  return { data: data.data ?? [], pagination: data.pagination };
}

export async function adminListDiscussions(
  params: ListDiscussionsParams = {},
): Promise<DiscussionListResponse> {
  const { data } = await api.get(API_ENDPOINTS.DISCUSSIONS.ADMIN_ALL, { params });
  return { data: data.data ?? [], pagination: data.pagination };
}

export async function getDiscussion(id: number): Promise<Discussion> {
  const { data } = await api.get(API_ENDPOINTS.DISCUSSIONS.BY_ID(id));
  return data.data;
}

export async function createDiscussion(payload: CreateDiscussionPayload): Promise<Discussion> {
  const { data } = await api.post(API_ENDPOINTS.DISCUSSIONS.BASE, discussionFormData(payload));
  return data.data;
}

export async function updateDiscussion(
  id: number,
  payload: UpdateDiscussionPayload,
): Promise<Discussion> {
  const { data } = await api.put(API_ENDPOINTS.DISCUSSIONS.BY_ID(id), payload);
  return data.data;
}

export async function deleteDiscussion(id: number): Promise<void> {
  await api.delete(API_ENDPOINTS.DISCUSSIONS.BY_ID(id));
}

export async function createReply(
  discussionId: number,
  content: string,
  links: Array<{ url: string; title?: string }> = [],
  files: File[] = [],
): Promise<DiscussionReply> {
  const { data } = await api.post(
    API_ENDPOINTS.DISCUSSIONS.REPLIES(discussionId),
    replyFormData(content, links, files),
  );
  return data.data;
}

export async function updateReply(replyId: number, content: string): Promise<DiscussionReply> {
  const { data } = await api.put(API_ENDPOINTS.DISCUSSIONS.REPLY_BY_ID(replyId), { content });
  return data.data;
}

export async function deleteReply(replyId: number): Promise<void> {
  await api.delete(API_ENDPOINTS.DISCUSSIONS.REPLY_BY_ID(replyId));
}

export async function getDiscussionAttachmentUrl(attachmentId: number): Promise<string> {
  const { data } = await api.get(API_ENDPOINTS.DISCUSSIONS.ATTACHMENT_DOWNLOAD_URL(attachmentId));
  return data.data.url;
}
