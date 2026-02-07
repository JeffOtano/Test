import {
  LinearIssue,
  LinearWorkflowState,
  ShortcutStory,
  ShortcutWorkflowState,
} from '@/types';

type ShortcutWorkflow = {
  states: ShortcutWorkflowState[];
};

export type ShortcutStateType = ShortcutWorkflowState['type'];

interface ShortcutStateIdByType {
  unstarted?: number;
  started?: number;
  done?: number;
}

interface LinearStateIdByShortcutType {
  unstarted?: string;
  started?: string;
  done?: string;
}

function sortLinearStates(states: LinearWorkflowState[]): LinearWorkflowState[] {
  return [...states].sort((a, b) => a.position - b.position);
}

function firstLinearStateId(
  states: LinearWorkflowState[],
  preferredTypes: LinearWorkflowState['type'][]
): string | undefined {
  for (const type of preferredTypes) {
    const match = states.find((state) => state.type === type);
    if (match) return match.id;
  }
  return undefined;
}

export function buildShortcutStateTypeById(
  workflows: ShortcutWorkflow[]
): Map<number, ShortcutStateType> {
  const mapping = new Map<number, ShortcutStateType>();
  for (const workflow of workflows) {
    for (const state of workflow.states) {
      mapping.set(state.id, state.type);
    }
  }
  return mapping;
}

export function buildShortcutStateIdByType(
  workflows: ShortcutWorkflow[]
): ShortcutStateIdByType {
  const result: ShortcutStateIdByType = {};

  for (const workflow of workflows) {
    for (const state of workflow.states) {
      if (!result[state.type]) {
        result[state.type] = state.id;
      }
    }
  }

  return result;
}

export function buildLinearStateIdByShortcutType(
  workflowStates: LinearWorkflowState[]
): LinearStateIdByShortcutType {
  const states = sortLinearStates(workflowStates);

  const unstarted =
    firstLinearStateId(states, ['unstarted', 'backlog']) ?? states[0]?.id;
  const started =
    firstLinearStateId(states, ['started']) ?? unstarted ?? states[0]?.id;
  const done =
    firstLinearStateId(states, ['completed', 'canceled']) ??
    started ??
    unstarted ??
    states[0]?.id;

  return { unstarted, started, done };
}

export function mapLinearTypeToShortcutType(
  linearType: LinearWorkflowState['type']
): ShortcutStateType {
  if (linearType === 'started') return 'started';
  if (linearType === 'completed' || linearType === 'canceled') return 'done';
  return 'unstarted';
}

export function mapIssueToShortcutStateId(
  issue: Pick<LinearIssue, 'state'>,
  shortcutStateIdByType: ShortcutStateIdByType
): number | undefined {
  const shortcutType = mapLinearTypeToShortcutType(issue.state.type);
  return shortcutStateIdByType[shortcutType];
}

export function mapStoryToShortcutStateType(
  story: Pick<ShortcutStory, 'workflow_state_id' | 'completed_at'>,
  shortcutStateTypeById: Map<number, ShortcutStateType>
): ShortcutStateType {
  const explicitType = shortcutStateTypeById.get(story.workflow_state_id);
  if (explicitType) return explicitType;
  if (story.completed_at) return 'done';
  return 'unstarted';
}

export function mapStoryToLinearStateId(
  story: Pick<ShortcutStory, 'workflow_state_id' | 'completed_at'>,
  shortcutStateTypeById: Map<number, ShortcutStateType>,
  linearStateIdByShortcutType: LinearStateIdByShortcutType
): string | undefined {
  const shortcutType = mapStoryToShortcutStateType(story, shortcutStateTypeById);
  return linearStateIdByShortcutType[shortcutType];
}
