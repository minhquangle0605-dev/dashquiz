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
  const { data } = await api.post(API_ENDPOINTS.DISCUSSIONS.BASE, payload);
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
): Promise<DiscussionReply> {
  const { data } = await api.post(API_ENDPOINTS.DISCUSSIONS.REPLIES(discussionId), { content });
  return data.data;
}

export async function updateReply(replyId: number, content: string): Promise<DiscussionReply> {
  const { data } = await api.put(API_ENDPOINTS.DISCUSSIONS.REPLY_BY_ID(replyId), { content });
  return data.data;
}

export async function deleteReply(replyId: number): Promise<void> {
  await api.delete(API_ENDPOINTS.DISCUSSIONS.REPLY_BY_ID(replyId));
}
