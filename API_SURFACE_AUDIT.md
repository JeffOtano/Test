# API Surface Audit (Shortcut <-> Linear)

Last updated: 2026-02-07

This document tracks what both APIs support and what this repo currently implements.

## Primary Sources

- Shortcut REST v3: [developer.shortcut.com/api/rest/v3](https://developer.shortcut.com/api/rest/v3)
- Linear GraphQL SDK types in repo: `node_modules/@linear/sdk/dist/index.d.cts`
- Linear API docs: [developers.linear.app](https://developers.linear.app)

## Capability Matrix

| Domain | Shortcut API | Linear API | One-shot Migration | Real-time Sync |
|---|---|---|---|---|
| Title/name | Story `name` | Issue `title` | Yes | Yes |
| Description | Story `description` | Issue `description` | Yes | Yes |
| Workflow state | Story `workflow_state_id` + Workflows | Issue `stateId` + Team states | Yes | Yes |
| Labels/tags | Story `labels` (CreateLabelParams) | Issue `labelIds` + Issue labels | Yes | Yes |
| Comments | Story comments endpoints | Issue comments (`issue.comments`, `createComment`) | Yes | Yes (create-sync, idempotent) |
| Links/attachments | Story `external_links` | Issue attachments (`issue.attachments`, `createAttachment`) | Yes | Yes |
| Priority/story type | Story `story_type` | Issue `priority` | Yes | Yes |
| Estimates | Story `estimate` | Issue `estimate` | Yes | Yes |
| Epics/projects | Story `epic_id` | Issue `projectId` | Yes | Not yet |
| Iterations/cycles | Story `iteration_id` | Issue `cycleId` | Yes | Not yet |
| Assignees/owners | Story `owner_ids` | Issue `assigneeId` | Not yet | Not yet |
| Parent/subtasks | Story sub-tasks | Issue parent/children | Not yet | Not yet |
| Link relations | Story links | Issue relations | Not yet | Not yet |
| Custom fields | Story custom_fields | Linear custom fields | Not yet | Not yet |
| Deletions/archival parity | Story archive/delete | Issue archive/delete | Partial | Partial |

## Important Notes

- Real-time comments currently sync as additive creates with metadata markers to prevent loops.
- Shortcut -> Linear attachment sync is additive (creates missing URLs).
- Linear -> Shortcut attachment sync mirrors issue attachment URLs into `external_links`.
- Label sync now creates missing Linear labels on demand and mirrors Linear labels into Shortcut story labels.

## Next Milestones

1. Realtime project/epic and cycle/iteration parity.
2. Assignee/owner mapping with team member identity resolution.
3. Comment update/delete parity (currently create only).
4. Attachment delete parity Shortcut -> Linear.
5. Parent/sub-task and relation graph migration/sync.
