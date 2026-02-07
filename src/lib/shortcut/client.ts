import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import {
  ShortcutTeam,
  ShortcutProject,
  ShortcutEpic,
  ShortcutIteration,
  ShortcutStory,
  ShortcutLabel,
  ShortcutWorkflowState,
  ShortcutMember,
  ShortcutComment,
} from '@/types';

const SHORTCUT_API_URL = 'https://api.app.shortcut.com/api/v3';
const MAX_RATE_LIMIT_RETRIES = 5;

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
}

type SearchStoriesResponse = {
  data?: ShortcutStory[];
  next?: string | null;
};

const SEARCH_STORIES_MAX_PAGE_SIZE = 250;
const GROUP_STORIES_MAX_LIMIT = 1000;
const MIN_BATCH_SIZE = 1;

export class ShortcutClient {
  private client: AxiosInstance;
  private rateLimitRemaining = 200;
  private rateLimitResetAtMs = 0;

  constructor(accessToken: string) {
    const isBrowser = typeof window !== 'undefined';
    this.client = axios.create({
      baseURL: isBrowser ? '/api/shortcut' : SHORTCUT_API_URL,
      headers: {
        'Content-Type': 'application/json',
        ...(isBrowser
          ? { 'x-shortcut-token': accessToken }
          : { 'Shortcut-Token': accessToken }),
      },
    });

    // Update local rate limit tracking and retry on 429.
    this.client.interceptors.response.use(
      (response) => {
        const remainingHeader =
          response.headers['x-rate-limit-remaining'] ??
          response.headers['x-ratelimit-remaining'];
        const resetHeader =
          response.headers['x-rate-limit-reset'] ?? response.headers['x-ratelimit-reset'];

        const remaining = Number.parseInt(String(remainingHeader ?? '200'), 10);
        const resetSeconds = Number.parseInt(String(resetHeader ?? '0'), 10);

        if (Number.isFinite(remaining)) {
          this.rateLimitRemaining = remaining;
        }

        if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
          this.rateLimitResetAtMs = resetSeconds * 1000;
        }

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as RetryableRequestConfig | undefined;
        if (error.response?.status === 429 && config) {
          const retryAfterHeader = error.response.headers?.['retry-after'];
          const retryAfterSeconds = Number.parseInt(String(retryAfterHeader ?? '2'), 10);
          const retryCount = config.__retryCount ?? 0;

          if (retryCount >= MAX_RATE_LIMIT_RETRIES) {
            throw error;
          }

          config.__retryCount = retryCount + 1;
          await this.sleep(Math.max(1, retryAfterSeconds) * 1000);
          return this.client.request(config);
        }

        throw error;
      }
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async checkRateLimit(): Promise<void> {
    if (this.rateLimitRemaining < 10 && this.rateLimitResetAtMs > 0) {
      const waitTime = Math.max(0, this.rateLimitResetAtMs - Date.now());
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }
  }

  // Workspace / Member info
  async getCurrentMember(): Promise<ShortcutMember> {
    await this.checkRateLimit();
    const response = await this.client.get('/member');
    return response.data;
  }

  async getMembers(): Promise<ShortcutMember[]> {
    await this.checkRateLimit();
    const response = await this.client.get('/members');
    return response.data;
  }

  // Teams
  async getTeams(): Promise<ShortcutTeam[]> {
    await this.checkRateLimit();
    const response = await this.client.get('/groups');
    return response.data;
  }

  async getTeam(teamId: string | number): Promise<ShortcutTeam> {
    await this.checkRateLimit();
    const response = await this.client.get(`/groups/${teamId}`);
    return response.data;
  }

  // Projects
  async getProjects(): Promise<ShortcutProject[]> {
    await this.checkRateLimit();
    const response = await this.client.get('/projects');
    return response.data;
  }

  async getProject(projectId: number): Promise<ShortcutProject> {
    await this.checkRateLimit();
    const response = await this.client.get(`/projects/${projectId}`);
    return response.data;
  }

  // Epics
  async getEpics(): Promise<ShortcutEpic[]> {
    await this.checkRateLimit();
    const response = await this.client.get('/epics');
    return response.data;
  }

  async getEpic(epicId: number): Promise<ShortcutEpic> {
    await this.checkRateLimit();
    const response = await this.client.get(`/epics/${epicId}`);
    return response.data;
  }

  // Iterations
  async getIterations(): Promise<ShortcutIteration[]> {
    await this.checkRateLimit();
    const response = await this.client.get('/iterations');
    return response.data;
  }

  async getIteration(iterationId: number): Promise<ShortcutIteration> {
    await this.checkRateLimit();
    const response = await this.client.get(`/iterations/${iterationId}`);
    return response.data;
  }

  // Labels
  async getLabels(): Promise<ShortcutLabel[]> {
    await this.checkRateLimit();
    const response = await this.client.get('/labels');
    return response.data;
  }

  // Workflows
  async getWorkflows(): Promise<{ id: number; name: string; states: ShortcutWorkflowState[] }[]> {
    await this.checkRateLimit();
    const response = await this.client.get('/workflows');
    return response.data;
  }

  // Stories
  async searchStories(query: string, pageSize: number = 25): Promise<ShortcutStory[]> {
    await this.checkRateLimit();
    const response = await this.client.get('/search/stories', {
      params: { query, page_size: pageSize },
    });
    return response.data.data;
  }

  async getStory(storyId: number): Promise<ShortcutStory> {
    await this.checkRateLimit();
    const response = await this.client.get(`/stories/${storyId}`);
    return response.data;
  }

  async createStory(params: {
    name: string;
    description?: string;
    story_type?: ShortcutStory['story_type'];
    workflow_state_id: number;
    estimate?: number;
    project_id?: number;
    iteration_id?: number;
    owner_ids?: string[];
  }): Promise<ShortcutStory> {
    await this.checkRateLimit();
    const response = await this.client.post('/stories', params);
    return response.data;
  }

  async updateStory(
    storyId: number,
    params: Partial<{
      name: string;
      description: string;
      story_type: ShortcutStory['story_type'];
      workflow_state_id: number;
      estimate: number;
      project_id: number;
      iteration_id: number;
      owner_ids: string[];
      archived: boolean;
    }>
  ): Promise<ShortcutStory> {
    await this.checkRateLimit();
    const response = await this.client.put(`/stories/${storyId}`, params);
    return response.data;
  }

  async getStoriesForProject(projectId: number): Promise<ShortcutStory[]> {
    return this.searchStories(`project:${projectId}`);
  }

  async getStoriesForEpic(epicId: number): Promise<ShortcutStory[]> {
    return this.searchStories(`epic:${epicId}`);
  }

  async getStoriesForIteration(iterationId: number): Promise<ShortcutStory[]> {
    return this.searchStories(`iteration:${iterationId}`);
  }

  async getStoriesForTeam(
    teamId: string | number,
    batchSize: number = GROUP_STORIES_MAX_LIMIT
  ): Promise<ShortcutStory[]> {
    const normalizedBatchSize = this.normalizeBatchSize(
      batchSize,
      GROUP_STORIES_MAX_LIMIT
    );
    return this.getStoriesForGroup(teamId, normalizedBatchSize);
  }

  async getAllStories(batchSize: number = 1000): Promise<ShortcutStory[]> {
    const searchPageSize = this.normalizeBatchSize(
      batchSize,
      SEARCH_STORIES_MAX_PAGE_SIZE
    );

    try {
      return await this.getAllStoriesViaSearch(searchPageSize);
    } catch {
      // Search endpoints can fail for very large workspaces; use group pagination as fallback.
      const groupBatchSize = this.normalizeBatchSize(batchSize, GROUP_STORIES_MAX_LIMIT);
      return this.getAllStoriesViaGroups(groupBatchSize);
    }
  }

  private normalizeBatchSize(batchSize: number, max: number): number {
    const parsed = Number.isFinite(batchSize)
      ? Math.trunc(batchSize)
      : SEARCH_STORIES_MAX_PAGE_SIZE;
    return Math.min(Math.max(parsed, MIN_BATCH_SIZE), max);
  }

  private async getAllStoriesViaSearch(batchSize: number): Promise<ShortcutStory[]> {
    const allStories: ShortcutStory[] = [];
    let nextToken: string | undefined = undefined;
    let previousToken: string | undefined = undefined;

    while (true) {
      await this.checkRateLimit();
      const params = this.buildStoriesSearchParams(batchSize, nextToken);
      const response = await this.client.get<SearchStoriesResponse>(
        '/search/stories',
        { params }
      );

      const batch = Array.isArray(response.data?.data) ? response.data.data : [];
      allStories.push(...batch);

      previousToken = nextToken;
      nextToken = typeof response.data?.next === 'string' ? response.data.next : undefined;

      // Defensive break to avoid infinite loops if API returns the same cursor repeatedly.
      if (!nextToken || nextToken === previousToken) {
        break;
      }
    }

    return allStories;
  }

  private async getAllStoriesViaGroups(batchSize: number): Promise<ShortcutStory[]> {
    const teams = await this.getTeams();
    const storiesById = new Map<number, ShortcutStory>();

    for (const team of teams) {
      const stories = await this.getStoriesForGroup(team.id, batchSize);
      for (const story of stories) {
        storiesById.set(story.id, story);
      }
    }

    return Array.from(storiesById.values());
  }

  private async getStoriesForGroup(
    teamId: string | number,
    batchSize: number
  ): Promise<ShortcutStory[]> {
    const stories: ShortcutStory[] = [];
    let offset = 0;

    while (true) {
      await this.checkRateLimit();
      const response = await this.client.get<ShortcutStory[]>(
        `/groups/${teamId}/stories`,
        {
          params: { limit: batchSize, offset },
        }
      );

      const batch = Array.isArray(response.data) ? response.data : [];
      stories.push(...batch);

      if (batch.length < batchSize) {
        break;
      }

      offset += batch.length;
    }

    return stories;
  }

  private buildStoriesSearchParams(
    batchSize: number,
    nextToken?: string
  ): Record<string, string> {
    const params = new URLSearchParams();
    params.set('query', '*');
    params.set('entity_types', 'story');
    params.set('page_size', String(batchSize));

    if (!nextToken) {
      return Object.fromEntries(params.entries());
    }

    let candidate = nextToken.trim();

    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
      const parsed = new URL(candidate);
      candidate = parsed.search.startsWith('?')
        ? parsed.search.slice(1)
        : parsed.search;
    } else if (candidate.startsWith('/')) {
      const queryStart = candidate.indexOf('?');
      candidate = queryStart >= 0 ? candidate.slice(queryStart + 1) : '';
    }

    if (candidate.includes('=')) {
      const parsed = new URLSearchParams(candidate);
      parsed.forEach((value, key) => params.set(key, value));
    } else if (candidate) {
      params.set('next', candidate);
    }

    return Object.fromEntries(params.entries());
  }

  // Comments
  async getStoryComments(storyId: number): Promise<ShortcutComment[]> {
    await this.checkRateLimit();
    try {
      const response = await this.client.get(`/stories/${storyId}/comments`);
      return Array.isArray(response.data) ? (response.data as ShortcutComment[]) : [];
    } catch {
      const story = await this.getStory(storyId);
      return (story as ShortcutStory & { comments?: ShortcutComment[] }).comments ?? [];
    }
  }

  async createStoryComment(
    storyId: number,
    params: {
      text: string;
      author_id?: string;
      created_at?: string;
      external_id?: string;
      parent_id?: number;
      updated_at?: string;
    }
  ): Promise<ShortcutComment> {
    await this.checkRateLimit();
    const response = await this.client.post(`/stories/${storyId}/comments`, params);
    return response.data;
  }

  // Export all data
  async exportAll(): Promise<{
    members: ShortcutMember[];
    teams: ShortcutTeam[];
    projects: ShortcutProject[];
    epics: ShortcutEpic[];
    iterations: ShortcutIteration[];
    labels: ShortcutLabel[];
    workflows: { id: number; name: string; states: ShortcutWorkflowState[] }[];
    stories: ShortcutStory[];
  }> {
    const [members, teams, projects, epics, iterations, labels, workflows, stories] =
      await Promise.all([
        this.getMembers(),
        this.getTeams(),
        this.getProjects(),
        this.getEpics(),
        this.getIterations(),
        this.getLabels(),
        this.getWorkflows(),
        this.getAllStories(),
      ]);

    return {
      members,
      teams,
      projects,
      epics,
      iterations,
      labels,
      workflows,
      stories,
    };
  }
}

export function createShortcutClient(accessToken: string): ShortcutClient {
  return new ShortcutClient(accessToken);
}
