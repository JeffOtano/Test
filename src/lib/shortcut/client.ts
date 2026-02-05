import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ShortcutWorkspace,
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

export class ShortcutClient {
  private client: AxiosInstance;
  private rateLimitRemaining: number = 200;
  private rateLimitReset: number = 0;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: SHORTCUT_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Shortcut-Token': accessToken,
      },
    });

    // Rate limiting interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.rateLimitRemaining = parseInt(response.headers['x-rate-limit-remaining'] || '200');
        this.rateLimitReset = parseInt(response.headers['x-rate-limit-reset'] || '0');
        return response;
      },
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          await this.sleep(retryAfter * 1000);
          return this.client.request(error.config!);
        }
        throw error;
      }
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async checkRateLimit(): Promise<void> {
    if (this.rateLimitRemaining < 10) {
      const waitTime = Math.max(0, this.rateLimitReset - Date.now());
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

  async getTeam(teamId: number): Promise<ShortcutTeam> {
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

  async getStoriesForProject(projectId: number): Promise<ShortcutStory[]> {
    return this.searchStories(`project:${projectId}`);
  }

  async getStoriesForEpic(epicId: number): Promise<ShortcutStory[]> {
    return this.searchStories(`epic:${epicId}`);
  }

  async getStoriesForIteration(iterationId: number): Promise<ShortcutStory[]> {
    return this.searchStories(`iteration:${iterationId}`);
  }

  async getAllStories(batchSize: number = 100): Promise<ShortcutStory[]> {
    const allStories: ShortcutStory[] = [];
    let hasMore = true;
    let nextToken: string | undefined;

    while (hasMore) {
      await this.checkRateLimit();
      const response = await this.client.post('/stories/search', {
        page_size: batchSize,
        next: nextToken,
      });

      allStories.push(...response.data.data);
      nextToken = response.data.next;
      hasMore = !!nextToken;
    }

    return allStories;
  }

  // Comments
  async getStoryComments(storyId: number): Promise<ShortcutComment[]> {
    await this.checkRateLimit();
    const story = await this.getStory(storyId);
    return (story as ShortcutStory & { comments: ShortcutComment[] }).comments || [];
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
