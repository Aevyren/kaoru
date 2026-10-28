import { relations } from "drizzle-orm";
import {
  profiles,
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  projects,
  tasks,
  taskAssignees,
  taskAttachments,
  taskMessages,
  notifications,
} from "@/db/schema";

// 1. PROFILES RELATIONS
export const profilesRelations = relations(profiles, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
  sentInvitations: many(workspaceInvitations),
  createdProjects: many(projects),
  createdTasks: many(tasks),
  taskAssignments: many(taskAssignees),
  uploadedAttachments: many(taskAttachments),
  taskMessages: many(taskMessages),
  receivedNotifications: many(notifications, {
    relationName: "recipientNotifications",
  }),
  triggeredNotifications: many(notifications, {
    relationName: "actorNotifications",
  }),
}));

// 2. WORKSPACES RELATIONS
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [workspaces.ownerId],
    references: [profiles.id],
  }),
  members: many(workspaceMembers),
  invitations: many(workspaceInvitations),
  projects: many(projects),
  tasks: many(tasks),
  taskAssignees: many(taskAssignees),
  taskAttachments: many(taskAttachments),
  taskMessages: many(taskMessages),
  notifications: many(notifications),
}));

// 3. WORKSPACE MEMBERS RELATIONS
export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(profiles, {
      fields: [workspaceMembers.userId],
      references: [profiles.id],
    }),
  }),
);

// 4. WORKSPACE INVITATIONS RELATIONS
export const workspaceInvitationsRelations = relations(
  workspaceInvitations,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInvitations.workspaceId],
      references: [workspaces.id],
    }),
    inviter: one(profiles, {
      fields: [workspaceInvitations.invitedBy],
      references: [profiles.id],
    }),
  }),
);

// 5. PROJECTS RELATIONS
export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(profiles, {
    fields: [projects.createdBy],
    references: [profiles.id],
  }),
  tasks: many(tasks),
}));

// 6. TASKS RELATIONS
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  workspace: one(workspaces, {
    fields: [tasks.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(profiles, {
    fields: [tasks.createdBy],
    references: [profiles.id],
  }),
  assignees: many(taskAssignees),
  attachments: many(taskAttachments),
  messages: many(taskMessages),
  notifications: many(notifications),
}));

// 7. TASK ASSIGNEES RELATIONS (Multi-Assignee Junction)
export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignees.taskId],
    references: [tasks.id],
  }),
  user: one(profiles, {
    fields: [taskAssignees.userId],
    references: [profiles.id],
  }),
  workspace: one(workspaces, {
    fields: [taskAssignees.workspaceId],
    references: [workspaces.id],
  }),
}));

// 8. TASK ATTACHMENTS RELATIONS
export const taskAttachmentsRelations = relations(
  taskAttachments,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskAttachments.taskId],
      references: [tasks.id],
    }),
    workspace: one(workspaces, {
      fields: [taskAttachments.workspaceId],
      references: [workspaces.id],
    }),
    uploader: one(profiles, {
      fields: [taskAttachments.uploadedBy],
      references: [profiles.id],
    }),
  }),
);

// 9. TASK MESSAGES RELATIONS
export const taskMessagesRelations = relations(taskMessages, ({ one }) => ({
  task: one(tasks, {
    fields: [taskMessages.taskId],
    references: [tasks.id],
  }),
  workspace: one(workspaces, {
    fields: [taskMessages.workspaceId],
    references: [workspaces.id],
  }),
  author: one(profiles, {
    fields: [taskMessages.authorId],
    references: [profiles.id],
  }),
}));

// 10. NOTIFICATIONS RELATIONS
export const notificationsRelations = relations(notifications, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
  recipient: one(profiles, {
    fields: [notifications.recipientId],
    references: [profiles.id],
    relationName: "recipientNotifications",
  }),
  actor: one(profiles, {
    fields: [notifications.actorId],
    references: [profiles.id],
    relationName: "actorNotifications",
  }),
  task: one(tasks, {
    fields: [notifications.resourceId],
    references: [tasks.id],
  }),
}));
