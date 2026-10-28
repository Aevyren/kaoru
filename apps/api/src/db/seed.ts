import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import * as relations from "@/db/relation";

// Deterministic UUIDs for 100% idempotent seeding
const USERS = {
  alex: {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Alex Chen",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
  },
  sarah: {
    id: "22222222-2222-4222-8222-222222222222",
    fullName: "Sarah Connor",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
  },
  kenji: {
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "Kenji Sato",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
  },
};

const WORKSPACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const PROJECTS = {
  core: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Core App Redesign",
    slug: "core-app-redesign",
    color: "indigo",
    description:
      "Re-architecting user experience, design tokens, and components.",
  },
  growth: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Marketing & Growth",
    slug: "marketing-and-growth",
    color: "emerald",
    description: "Landing page conversion optimizations and brand showcase.",
  },
};

const TASKS = {
  board: {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    title: "Design high-fidelity Kanban board",
    description:
      "Align Figma board components with shadcn/ui primitives and theme tokens.",
    status: "in_progress" as const,
    priority: "urgent" as const,
    dueDate: "2026-11-01",
  },
  schema: {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    title: "Implement Drizzle schema and migrations",
    description:
      "Write 10 canonical tables with multi-tenancy triggers and cascade rules.",
    status: "done" as const,
    priority: "high" as const,
    dueDate: "2026-10-25",
  },
  auth: {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    title: "Supabase Auth & RBAC integration",
    description:
      "Hook auth.users into profiles and enforce workspace role gates.",
    status: "todo" as const,
    priority: "medium" as const,
    dueDate: "2026-11-10",
  },
};

async function seed() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL!;
  console.log("🌱 Starting database seeding...");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema: { ...schema, ...relations } });

  try {
    // 1. Seed Profiles
    console.log("  Inserting demo profiles...");
    for (const u of Object.values(USERS)) {
      await db
        .insert(schema.profiles)
        .values({
          id: u.id,
          fullName: u.fullName,
          avatarUrl: u.avatarUrl,
        })
        .onConflictDoUpdate({
          target: schema.profiles.id,
          set: { fullName: u.fullName, avatarUrl: u.avatarUrl },
        });
    }

    // 2. Seed Workspace (Alex Chen is owner)
    console.log("  Inserting demo workspace...");
    await db
      .insert(schema.workspaces)
      .values({
        id: WORKSPACE_ID,
        name: "Kaoru HQ",
        slug: "kaoru-hq",
        ownerId: USERS.alex.id,
      })
      .onConflictDoUpdate({
        target: schema.workspaces.id,
        set: { name: "Kaoru HQ", slug: "kaoru-hq" },
      });

    // 3. Seed Workspace Members (Alex: owner, Sarah: admin, Kenji: member)
    console.log("  Inserting workspace members...");
    const memberRoles = [
      { userId: USERS.alex.id, role: "owner" as const },
      { userId: USERS.sarah.id, role: "admin" as const },
      { userId: USERS.kenji.id, role: "member" as const },
    ];
    for (const m of memberRoles) {
      await db
        .insert(schema.workspaceMembers)
        .values({
          workspaceId: WORKSPACE_ID,
          userId: m.userId,
          role: m.role,
        })
        .onConflictDoNothing();
    }

    // 4. Seed Projects
    console.log("  Inserting demo projects...");
    for (const p of Object.values(PROJECTS)) {
      await db
        .insert(schema.projects)
        .values({
          id: p.id,
          workspaceId: WORKSPACE_ID,
          name: p.name,
          slug: p.slug,
          color: p.color,
          description: p.description,
          createdBy: USERS.alex.id,
        })
        .onConflictDoUpdate({
          target: schema.projects.id,
          set: {
            name: p.name,
            slug: p.slug,
            color: p.color,
            description: p.description,
          },
        });
    }

    // 5. Seed Tasks
    console.log("  Inserting demo tasks...");
    await db
      .insert(schema.tasks)
      .values({
        id: TASKS.board.id,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECTS.core.id,
        title: TASKS.board.title,
        description: TASKS.board.description,
        status: TASKS.board.status,
        priority: TASKS.board.priority,
        dueDate: TASKS.board.dueDate,
        createdBy: USERS.alex.id,
      })
      .onConflictDoNothing();

    await db
      .insert(schema.tasks)
      .values({
        id: TASKS.schema.id,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECTS.core.id,
        title: TASKS.schema.title,
        description: TASKS.schema.description,
        status: TASKS.schema.status,
        priority: TASKS.schema.priority,
        dueDate: TASKS.schema.dueDate,
        createdBy: USERS.alex.id,
      })
      .onConflictDoNothing();

    await db
      .insert(schema.tasks)
      .values({
        id: TASKS.auth.id,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECTS.core.id,
        title: TASKS.auth.title,
        description: TASKS.auth.description,
        status: TASKS.auth.status,
        priority: TASKS.auth.priority,
        dueDate: TASKS.auth.dueDate,
        createdBy: USERS.alex.id,
      })
      .onConflictDoNothing();

    // 6. Seed Multi-Assignees (Task 1 assigned to BOTH Alex & Sarah)
    console.log("  Assigning tasks (multi-assignee demonstration)...");
    const assignments = [
      { taskId: TASKS.board.id, userId: USERS.alex.id },
      { taskId: TASKS.board.id, userId: USERS.sarah.id },
      { taskId: TASKS.schema.id, userId: USERS.kenji.id },
      { taskId: TASKS.auth.id, userId: USERS.alex.id },
      { taskId: TASKS.auth.id, userId: USERS.kenji.id },
    ];
    for (const a of assignments) {
      await db
        .insert(schema.taskAssignees)
        .values({
          taskId: a.taskId,
          userId: a.userId,
          workspaceId: WORKSPACE_ID,
        })
        .onConflictDoNothing();
    }

    // 7. Seed Task Messages (Comments)
    console.log("  Inserting contextual discussion comments...");
    await db
      .insert(schema.taskMessages)
      .values([
        {
          taskId: TASKS.board.id,
          workspaceId: WORKSPACE_ID,
          authorId: USERS.alex.id,
          content:
            "Working on the responsive breakpoints for the board layout.",
        },
        {
          taskId: TASKS.board.id,
          workspaceId: WORKSPACE_ID,
          authorId: USERS.sarah.id,
          content:
            "Looks great! Let's make sure the dark mode tokens align with shadcn styling.",
        },
      ])
      .onConflictDoNothing();

    // 8. Seed Task Attachment
    console.log("  Inserting demo task attachment...");
    await db
      .insert(schema.taskAttachments)
      .values({
        taskId: TASKS.board.id,
        workspaceId: WORKSPACE_ID,
        fileName: "kanban-wireframe-spec.pdf",
        fileSize: 1048576,
        mimeType: "application/pdf",
        storagePath: "attachments/kaoru-hq/kanban-wireframe-spec.pdf",
        uploadedBy: USERS.sarah.id,
      })
      .onConflictDoNothing();

    // 9. Seed In-app Notification
    console.log("  Inserting demo notification...");
    await db
      .insert(schema.notifications)
      .values({
        workspaceId: WORKSPACE_ID,
        recipientId: USERS.sarah.id,
        actorId: USERS.alex.id,
        type: "task_assigned",
        resourceId: TASKS.board.id,
        isRead: false,
      })
      .onConflictDoNothing();

    console.log("\n✨ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
