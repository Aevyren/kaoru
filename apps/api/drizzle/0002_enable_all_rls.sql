-- Enable Row Level Security (RLS) on all remaining tables for complete defense-in-depth
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
