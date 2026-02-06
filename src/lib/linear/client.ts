import { LinearClient as LinearSDK } from '@linear/sdk';
import {
  LinearCycle,
  LinearIssue,
  LinearLabel,
  LinearProject,
  LinearTeam,
  LinearUser,
  LinearWorkflowState,
  LinearWorkspace,
} from '@/types';

interface PaginatableConnection<T> {
  fetchNext: () => Promise<unknown>;
  nodes: T[];
  pageInfo: {
    hasNextPage: boolean;
  };
}

interface ListOptions {
  includeAllPages?: boolean;
  pageSize?: number;
}

function toIsoString(value: Date | null | undefined): string {
  return value instanceof Date ? value.toISOString() : new Date(0).toISOString();
}

export class LinearClient {
  private client: LinearSDK;

  constructor(accessToken: string) {
    const isBrowser = typeof window !== 'undefined';
    this.client = new LinearSDK(
      isBrowser
        ? { apiKey: accessToken, apiUrl: '/api/linear/graphql' }
        : { apiKey: accessToken }
    );
  }

  private async collectNodes<T>(
    connection: PaginatableConnection<T>,
    options: ListOptions = {}
  ): Promise<T[]> {
    const shouldPaginate = options.includeAllPages ?? false;
    if (!shouldPaginate) return connection.nodes;

    while (connection.pageInfo.hasNextPage) {
      await connection.fetchNext();
    }

    return connection.nodes;
  }

  // Organization / Workspace
  async getOrganization(): Promise<LinearWorkspace> {
    const org = await this.client.organization;
    return {
      id: org.id,
      name: org.name,
      urlKey: org.urlKey,
    };
  }

  // Users
  async getUsers(options: ListOptions = {}): Promise<LinearUser[]> {
    const users = await this.client.users({ first: options.pageSize ?? 250 });
    const nodes = await this.collectNodes(users as PaginatableConnection<(typeof users.nodes)[0]>, options);

    return nodes.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? undefined,
    }));
  }

  async getCurrentUser(): Promise<LinearUser> {
    const user = await this.client.viewer;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }

  // Teams
  async getTeams(options: ListOptions = {}): Promise<LinearTeam[]> {
    const teams = await this.client.teams({ first: options.pageSize ?? 250 });
    const nodes = await this.collectNodes(teams as PaginatableConnection<(typeof teams.nodes)[0]>, options);

    return nodes.map((team) => ({
      id: team.id,
      name: team.name,
      key: team.key,
      description: team.description ?? undefined,
    }));
  }

  async getTeam(teamId: string): Promise<LinearTeam> {
    const team = await this.client.team(teamId);
    return {
      id: team.id,
      name: team.name,
      key: team.key,
      description: team.description ?? undefined,
    };
  }

  async createTeam(name: string, key: string, description?: string): Promise<LinearTeam> {
    const result = await this.client.createTeam({
      name,
      key,
      description,
    });
    const team = await result.team;
    if (!team) throw new Error('Failed to create team');
    return {
      id: team.id,
      name: team.name,
      key: team.key,
      description: team.description ?? undefined,
    };
  }

  // Projects
  async getProjects(teamId?: string, options: ListOptions = {}): Promise<LinearProject[]> {
    const projects = await this.client.projects({
      first: options.pageSize ?? 250,
      filter: teamId ? { accessibleTeams: { some: { id: { eq: teamId } } } } : undefined,
    });
    const nodes = await this.collectNodes(
      projects as PaginatableConnection<(typeof projects.nodes)[0]>,
      options
    );

    return nodes.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description ?? undefined,
      state: String(project.state),
      teamIds: [],
    }));
  }

  async createProject(
    name: string,
    teamIds: string[],
    description?: string
  ): Promise<LinearProject> {
    const result = await this.client.createProject({
      name,
      teamIds,
      description,
    });
    const project = await result.project;
    if (!project) throw new Error('Failed to create project');
    return {
      id: project.id,
      name: project.name,
      description: project.description ?? undefined,
      state: String(project.state),
      teamIds,
    };
  }

  // Cycles
  async getCycles(teamId: string, options: ListOptions = {}): Promise<LinearCycle[]> {
    const team = await this.client.team(teamId);
    const cycles = await team.cycles({ first: options.pageSize ?? 250 });
    const nodes = await this.collectNodes(cycles as PaginatableConnection<(typeof cycles.nodes)[0]>, options);

    return nodes.map((cycle) => ({
      id: cycle.id,
      name: cycle.name ?? undefined,
      number: cycle.number,
      startsAt: toIsoString(cycle.startsAt),
      endsAt: toIsoString(cycle.endsAt),
    }));
  }

  async createCycle(
    teamId: string,
    startsAt: Date,
    endsAt: Date,
    name?: string
  ): Promise<LinearCycle> {
    const result = await this.client.createCycle({
      teamId,
      startsAt,
      endsAt,
      name,
    });
    const cycle = await result.cycle;
    if (!cycle) throw new Error('Failed to create cycle');
    return {
      id: cycle.id,
      name: cycle.name ?? undefined,
      number: cycle.number,
      startsAt: toIsoString(cycle.startsAt),
      endsAt: toIsoString(cycle.endsAt),
    };
  }

  // Labels
  async getLabels(teamId?: string, options: ListOptions = {}): Promise<LinearLabel[]> {
    const labels = await this.client.issueLabels({
      first: options.pageSize ?? 250,
      filter: teamId ? { team: { id: { eq: teamId } } } : undefined,
    });
    const nodes = await this.collectNodes(
      labels as PaginatableConnection<(typeof labels.nodes)[0]>,
      options
    );

    return nodes.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    }));
  }

  async createLabel(name: string, color: string, teamId?: string): Promise<LinearLabel> {
    const result = await this.client.createIssueLabel({
      name,
      color,
      teamId,
    });
    const label = await result.issueLabel;
    if (!label) throw new Error('Failed to create label');
    return {
      id: label.id,
      name: label.name,
      color: label.color,
    };
  }

  // Workflow States
  async getWorkflowStates(teamId: string): Promise<LinearWorkflowState[]> {
    const team = await this.client.team(teamId);
    const states = await team.states();
    return states.nodes.map((state) => ({
      id: state.id,
      name: state.name,
      type: state.type as LinearWorkflowState['type'],
      position: state.position,
    }));
  }

  // Issues
  async getIssues(
    teamId?: string,
    options: ListOptions & { limit?: number } = {}
  ): Promise<LinearIssue[]> {
    const first = options.pageSize ?? options.limit ?? 250;
    const issues = await this.client.issues({
      filter: teamId ? { team: { id: { eq: teamId } } } : undefined,
      first,
    });

    const nodes = await this.collectNodes(
      issues as PaginatableConnection<(typeof issues.nodes)[0]>,
      options
    );

    return Promise.all(
      nodes.map(async (issue) => {
        const state = await issue.state;
        const assignee = await issue.assignee;
        const project = await issue.project;
        const cycle = await issue.cycle;
        const labels = await issue.labels();

        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description ?? undefined,
          state: state
            ? {
                id: state.id,
                name: state.name,
                type: state.type as LinearWorkflowState['type'],
                position: state.position,
              }
            : { id: '', name: 'Unknown', type: 'backlog', position: 0 },
          priority: issue.priority,
          estimate: issue.estimate ?? undefined,
          labels: labels.nodes.map((l) => ({ id: l.id, name: l.name, color: l.color })),
          assignee: assignee
            ? {
                id: assignee.id,
                name: assignee.name,
                email: assignee.email,
                avatarUrl: assignee.avatarUrl ?? undefined,
              }
            : undefined,
          project: project
            ? { id: project.id, name: project.name, state: String(project.state), teamIds: [] }
            : undefined,
          cycle: cycle
            ? {
                id: cycle.id,
                number: cycle.number,
                startsAt: toIsoString(cycle.startsAt),
                endsAt: toIsoString(cycle.endsAt),
              }
            : undefined,
          createdAt: toIsoString(issue.createdAt),
          updatedAt: toIsoString(issue.updatedAt),
          completedAt: issue.completedAt ? toIsoString(issue.completedAt) : undefined,
        };
      })
    );
  }

  async createIssue(params: {
    teamId: string;
    title: string;
    description?: string;
    stateId?: string;
    assigneeId?: string;
    projectId?: string;
    cycleId?: string;
    labelIds?: string[];
    priority?: number;
    estimate?: number;
  }): Promise<LinearIssue> {
    const result = await this.client.createIssue(params);
    const issue = await result.issue;
    if (!issue) throw new Error('Failed to create issue');

    const state = await issue.state;
    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? undefined,
      state: state
        ? {
            id: state.id,
            name: state.name,
            type: state.type as LinearWorkflowState['type'],
            position: state.position,
          }
        : { id: '', name: 'Unknown', type: 'backlog', position: 0 },
      priority: issue.priority,
      estimate: issue.estimate ?? undefined,
      labels: [],
      createdAt: toIsoString(issue.createdAt),
      updatedAt: toIsoString(issue.updatedAt),
    };
  }

  // Comments
  async createComment(issueId: string, body: string): Promise<{ id: string }> {
    const result = await this.client.createComment({
      issueId,
      body,
    });
    const comment = await result.comment;
    if (!comment) throw new Error('Failed to create comment');
    return { id: comment.id };
  }

  // Attachments
  async createAttachment(issueId: string, url: string, title: string): Promise<{ id: string }> {
    const result = await this.client.createAttachment({
      issueId,
      url,
      title,
    });
    const attachment = await result.attachment;
    if (!attachment) throw new Error('Failed to create attachment');
    return { id: attachment.id };
  }
}

export function createLinearClient(accessToken: string): LinearClient {
  return new LinearClient(accessToken);
}
