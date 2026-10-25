import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  boolean,
  integer,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// SUBSYSTEM A: IDENTITY, MULTI-TENANCY & ACCESS CONTROL
// ============================================================================

// 1. PROFILES (1:1 mirror of Supabase auth.users via handle_new_user trigger)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // Directly references auth.users.id
  fullName: text("full_name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// 2. WORKSPACES (Multi-tenant root container)
export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }), // Safety gate
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 3. WORKSPACE MEMBERS (RBAC: owner | admin | member)
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 })
      .$type<"owner" | "admin" | "member">()
      .notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("workspace_members_ws_user_idx").on(table.workspaceId, table.userId),
  ],
);

// 4. WORKSPACE INVITATIONS (64-character cryptographic token with 7-day TTL)
export const workspaceInvitations = pgTable("workspace_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 })
    .$type<"admin" | "member">()
    .default("member")
    .notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 })
    .$type<"pending" | "accepted" | "expired">()
    .default("pending")
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================================
// SUBSYSTEM B: PROJECTS, TASKS & FILE ATTACHMENTS
// ============================================================================

// 5. PROJECTS (Team project initiatives with unique slug & color badge)
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  color: varchar("color", { length: 20 }).default("neutral").notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 })
    .$type<"active" | "archived">()
    .default("active")
    .notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 6. TASKS (Core execution entity - normalized without single assignee_id)
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 })
      .$type<"todo" | "in_progress" | "done">()
      .default("todo")
      .notNull(),
    priority: varchar("priority", { length: 20 })
      .$type<"low" | "medium" | "high" | "urgent">()
      .default("medium")
      .notNull(),
    dueDate: date("due_date"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tasks_ws_proj_status_idx").on(
      table.workspaceId,
      table.projectId,
      table.status,
    ),
    index("tasks_ws_due_status_idx").on(
      table.workspaceId,
      table.dueDate,
      table.status,
    ),
  ],
);

// 7. TASK ASSIGNEES (Many-to-Many Multi-Member Assignments)
export const taskAssignees = pgTable(
  "task_assignees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("task_assignees_task_user_idx").on(table.taskId, table.userId),
    index("task_assignees_user_ws_task_idx").on(
      table.userId,
      table.workspaceId,
      table.taskId,
    ),
  ],
);

// 8. TASK ATTACHMENTS (File metadata for dropzone uploads)
export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 150 }).notNull(),
  storagePath: text("storage_path").notNull(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================================
// SUBSYSTEM C: CONTEXTUAL DISCUSSION & NOTIFICATIONS
// ============================================================================

// 9. TASK MESSAGES (Contextual comment stream attached to tasks)
export const taskMessages = pgTable(
  "task_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("task_messages_task_created_idx").on(table.taskId, table.createdAt),
  ],
);

// 10. NOTIFICATIONS (In-app Activity & Alert Feed)
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 })
      .$type<"task_assigned" | "task_status_changed" | "task_comment">()
      .notNull(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_recipient_unread_idx").on(
      table.recipientId,
      table.isRead,
      table.createdAt,
    ),
  ],
);

// ============================================================================
// INFERRED TYPESCRIPT TYPES
// ============================================================================

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;

export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
export type NewWorkspaceInvitation = typeof workspaceInvitations.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type TaskAssignee = typeof taskAssignees.$inferSelect;
export type NewTaskAssignee = typeof taskAssignees.$inferInsert;

export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type NewTaskAttachment = typeof taskAttachments.$inferInsert;

export type TaskMessage = typeof taskMessages.$inferSelect;
export type NewTaskMessage = typeof taskMessages.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
