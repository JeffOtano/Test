import { describe, expect, it } from 'vitest';
import type { LinearIssue, LinearWorkflowState, ShortcutStory } from '@/types';
import {
  buildLinearStateIdByShortcutType,
  buildShortcutStateIdByType,
  buildShortcutStateTypeById,
  mapIssueToShortcutStateId,
  mapStoryToLinearStateId,
} from './workflow-state-mapping';

const shortcutWorkflows = [
  {
    states: [
      { id: 1, name: 'Todo', type: 'unstarted' as const, position: 1 },
      { id: 2, name: 'In Progress', type: 'started' as const, position: 2 },
      { id: 3, name: 'Done', type: 'done' as const, position: 3 },
    ],
  },
];

describe('workflow-state-mapping', () => {
  it('maps Shortcut story state to Linear state id by semantic type', () => {
    const linearStates: LinearWorkflowState[] = [
      { id: 's_backlog', name: 'Backlog', type: 'backlog', position: 0 },
      { id: 's_started', name: 'In Progress', type: 'started', position: 1 },
      { id: 's_done', name: 'Done', type: 'completed', position: 2 },
    ];

    const shortcutStateTypeById = buildShortcutStateTypeById(shortcutWorkflows);
    const linearStateIdByShortcutType = buildLinearStateIdByShortcutType(linearStates);
    const story = {
      workflow_state_id: 2,
      completed_at: undefined,
    } as Pick<ShortcutStory, 'workflow_state_id' | 'completed_at'>;

    expect(
      mapStoryToLinearStateId(
        story,
        shortcutStateTypeById,
        linearStateIdByShortcutType
      )
    ).toBe('s_started');
  });

  it('uses deterministic fallback ordering when Linear states are missing canonical types', () => {
    const linearStates: LinearWorkflowState[] = [
      { id: 'only_backlog', name: 'Backlog', type: 'backlog', position: 0 },
      { id: 'only_canceled', name: 'Canceled', type: 'canceled', position: 1 },
    ];

    const mapping = buildLinearStateIdByShortcutType(linearStates);
    expect(mapping.unstarted).toBe('only_backlog');
    expect(mapping.started).toBe('only_backlog');
    expect(mapping.done).toBe('only_canceled');
  });

  it('maps Linear issue state types to Shortcut workflow state ids', () => {
    const shortcutStateIdByType = buildShortcutStateIdByType(shortcutWorkflows);
    const issue = {
      state: { id: 'done', name: 'Done', type: 'completed', position: 3 },
    } as Pick<LinearIssue, 'state'>;

    expect(mapIssueToShortcutStateId(issue, shortcutStateIdByType)).toBe(3);
  });
});
