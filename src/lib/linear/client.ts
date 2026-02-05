import { LinearClient as LinearSDK } from '@linear/sdk';
import {
  LinearWorkspace,
  LinearTeam,
  LinearProject,
  LinearCycle,
  LinearIssue,
  LinearLabel,
  LinearWorkflowState,
  LinearUser,
} from '@/types';

export class LinearClient {
  private client: LinearSDK;

  constructor(accessToken: string) {
    this.client = new LinearSDK({ accessToken });
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
  async getUsers(): Promise<LinearUser[]> {
    const users = await this.client.users();
    return users.nodes.map((user) => ({
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
  async getTeams(): Promise<LinearTeam[]> {
    const teams = await this.client.teams();
    return teams.nodes.map((team) => ({
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
  async getProjects(teamId?: string): Promise<LinearProject[]> {
    const projects = await this.client.projects({
      filter: teamId ? { accessibleTeams: { some: { id: { eq: teamId } } } } : undefined,
    });
    return projects.nodes.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description ?? undefined,
      state: project.state,
      teamIds: [], // Would need additional query
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
      state: project.state,
      teamIds,
    };
  }

  // Cycles
  async getCycles(teamId: string): Promise<LinearCycle[]> {
    const team = await this.client.team(teamId);
    const cycles = await team.cycles();
    return cycles.nodes.map((cycle) => ({
      id: cycle.id,
      name: cycle.name ?? undefined,
      number: cycle.number,
      startsAt: cycle.startsAt.toISOString(),
      endsAt: cycle.endsAt.toISOString(),
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
      startsAt: cycle.startsAt.toISOString(),
      endsAt: cycle.endsAt.toISOString(),
    };
  }

  // Labels
  async getLabels(teamId?: string): Promise<LinearLabel[]> {
    const labels = await this.client.issueLabels({
      filter: teamId ? { team: { id: { eq: teamId } } } : undefined,
    });
    return labels.nodes.map((label) => ({
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
  async getIssues(teamId?: string, limit: number = 50): Promise<LinearIssue[]> {
    const issues = await this.client.issues({
      filter: teamId ? { team: { id: { eq: teamId } } } : undefined,
      first: limit,
    });

    return Promise.all(
      issues.nodes.map(async (issue) => {
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
            : { id: '', name: 'Unknown', type: 'backlog' as const, position: 0 },
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
            ? { id: project.id, name: project.name, state: project.state, teamIds: [] }
            : undefined,
          cycle: cycle
            ? {
                id: cycle.id,
                number: cycle.number,
                startsAt: cycle.startsAt.toISOString(),
                endsAt: cycle.endsAt.toISOString(),
              }
            : undefined,
          createdAt: issue.createdAt.toISOString(),
          updatedAt: issue.updatedAt.toISOString(),
          completedAt: issue.completedAt?.toISOString(),
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
        : { id: '', name: 'Unknown', type: 'backlog' as const, position: 0 },
      priority: issue.priority,
      estimate: issue.estimate ?? undefined,
      labels: [],
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
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
  async createAttachment(
    issueId: string,
    url: string,
    title: string
  ): Promise<{ id: string }> {
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
