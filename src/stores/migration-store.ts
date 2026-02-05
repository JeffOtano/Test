import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  MigrationMode,
  MigrationConfig,
  MigrationProgress,
  TeamMapping,
  WorkflowStateMapping,
  ShortcutTeam,
  ShortcutWorkflowState,
  LinearTeam,
  LinearWorkflowState,
} from '@/types';

interface MigrationState {
  // Current step in the wizard
  currentStep: number;
  setCurrentStep: (step: number) => void;

  // Migration mode
  mode: MigrationMode | null;
  setMode: (mode: MigrationMode) => void;

  // Source data (Shortcut)
  shortcutTeams: ShortcutTeam[];
  shortcutWorkflows: ShortcutWorkflowState[];
  setShortcutData: (teams: ShortcutTeam[], workflows: ShortcutWorkflowState[]) => void;

  // Target data (Linear)
  linearTeams: LinearTeam[];
  linearWorkflows: LinearWorkflowState[];
  setLinearData: (teams: LinearTeam[], workflows: LinearWorkflowState[]) => void;

  // Mappings
  teamMappings: TeamMapping[];
  setTeamMappings: (mappings: TeamMapping[]) => void;
  addTeamMapping: (mapping: TeamMapping) => void;
  removeTeamMapping: (shortcutTeamId: number) => void;

  workflowMappings: WorkflowStateMapping[];
  setWorkflowMappings: (mappings: WorkflowStateMapping[]) => void;
  addWorkflowMapping: (mapping: WorkflowStateMapping) => void;

  // Options
  epicHandling: 'project' | 'label' | 'skip';
  setEpicHandling: (handling: 'project' | 'label' | 'skip') => void;

  includeComments: boolean;
  setIncludeComments: (include: boolean) => void;

  includeAttachments: boolean;
  setIncludeAttachments: (include: boolean) => void;

  // Migration progress
  migrationId: string | null;
  setMigrationId: (id: string | null) => void;

  progress: MigrationProgress | null;
  setProgress: (progress: MigrationProgress | null) => void;

  // Build config
  buildConfig: () => MigrationConfig | null;

  // Reset
  reset: () => void;
}

const initialState = {
  currentStep: 0,
  mode: null as MigrationMode | null,
  shortcutTeams: [] as ShortcutTeam[],
  shortcutWorkflows: [] as ShortcutWorkflowState[],
  linearTeams: [] as LinearTeam[],
  linearWorkflows: [] as LinearWorkflowState[],
  teamMappings: [] as TeamMapping[],
  workflowMappings: [] as WorkflowStateMapping[],
  epicHandling: 'project' as const,
  includeComments: true,
  includeAttachments: true,
  migrationId: null as string | null,
  progress: null as MigrationProgress | null,
};

export const useMigrationStore = create<MigrationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentStep: (step) => set({ currentStep: step }),

      setMode: (mode) => set({ mode }),

      setShortcutData: (teams, workflows) =>
        set({ shortcutTeams: teams, shortcutWorkflows: workflows }),

      setLinearData: (teams, workflows) =>
        set({ linearTeams: teams, linearWorkflows: workflows }),

      setTeamMappings: (mappings) => set({ teamMappings: mappings }),

      addTeamMapping: (mapping) =>
        set((state) => ({
          teamMappings: [
            ...state.teamMappings.filter((m) => m.shortcutTeamId !== mapping.shortcutTeamId),
            mapping,
          ],
        })),

      removeTeamMapping: (shortcutTeamId) =>
        set((state) => ({
          teamMappings: state.teamMappings.filter((m) => m.shortcutTeamId !== shortcutTeamId),
        })),

      setWorkflowMappings: (mappings) => set({ workflowMappings: mappings }),

      addWorkflowMapping: (mapping) =>
        set((state) => ({
          workflowMappings: [
            ...state.workflowMappings.filter(
              (m) => m.shortcutStateId !== mapping.shortcutStateId
            ),
            mapping,
          ],
        })),

      setEpicHandling: (handling) => set({ epicHandling: handling }),

      setIncludeComments: (include) => set({ includeComments: include }),

      setIncludeAttachments: (include) => set({ includeAttachments: include }),

      setMigrationId: (id) => set({ migrationId: id }),

      setProgress: (progress) => set({ progress }),

      buildConfig: () => {
        const state = get();
        if (!state.mode) return null;

        return {
          mode: state.mode,
          shortcutWorkspaceId: '', // Set from session
          linearWorkspaceId: '', // Set from session
          teamMappings: state.teamMappings,
          workflowStateMappings: state.workflowMappings,
          epicHandling: state.epicHandling,
          includeComments: state.includeComments,
          includeAttachments: state.includeAttachments,
          dryRun: false,
        };
      },

      reset: () => set(initialState),
    }),
    {
      name: 'migration-store',
      partialize: (state) => ({
        mode: state.mode,
        teamMappings: state.teamMappings,
        workflowMappings: state.workflowMappings,
        epicHandling: state.epicHandling,
        includeComments: state.includeComments,
        includeAttachments: state.includeAttachments,
      }),
    }
  )
);
