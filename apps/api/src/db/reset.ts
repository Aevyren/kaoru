import postgres from "postgres";

async function reset() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL!;
  console.log("⚠️  Connecting to database to reset tables...");
  const sql = postgres(url, { max: 1 });

  try {
    await sql.begin(async (tx) => {
      console.log("🗑️  Truncating all tables in cascade...");
      await tx`
        TRUNCATE TABLE
          notifications,
          task_messages,
          task_attachments,
          task_assignees,
          tasks,
          projects,
          workspace_invitations,
          workspace_members,
          workspaces,
          profiles
        RESTART IDENTITY CASCADE;
      `;
    });
    console.log("✅ Database reset complete: all tables cleared.");
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

reset();
