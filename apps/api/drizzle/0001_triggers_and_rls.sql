-- 1. Trigram extension and fuzzy search indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING gin (name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON tasks USING gin (title gin_trgm_ops);
--> statement-breakpoint

-- 2. Denormalized Workspace ID Integrity Trigger
CREATE OR REPLACE FUNCTION sync_task_child_workspace_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT workspace_id INTO NEW.workspace_id FROM tasks WHERE id = NEW.task_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS enforce_task_assignees_ws ON task_assignees;
--> statement-breakpoint
CREATE TRIGGER enforce_task_assignees_ws
  BEFORE INSERT OR UPDATE ON task_assignees
  FOR EACH ROW EXECUTE FUNCTION sync_task_child_workspace_id();
--> statement-breakpoint
DROP TRIGGER IF EXISTS enforce_task_messages_ws ON task_messages;
--> statement-breakpoint
CREATE TRIGGER enforce_task_messages_ws
  BEFORE INSERT OR UPDATE ON task_messages
  FOR EACH ROW EXECUTE FUNCTION sync_task_child_workspace_id();
--> statement-breakpoint
DROP TRIGGER IF EXISTS enforce_task_attachments_ws ON task_attachments;
--> statement-breakpoint
CREATE TRIGGER enforce_task_attachments_ws
  BEFORE INSERT OR UPDATE ON task_attachments
  FOR EACH ROW EXECUTE FUNCTION sync_task_child_workspace_id();
--> statement-breakpoint

-- 3. Shared updated_at Timestamp Trigger
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_profiles_updated_at ON profiles;
--> statement-breakpoint
CREATE TRIGGER touch_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_workspaces_updated_at ON workspaces;
--> statement-breakpoint
CREATE TRIGGER touch_workspaces_updated_at
  BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_tasks_updated_at ON tasks;
--> statement-breakpoint
CREATE TRIGGER touch_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_task_messages_updated_at ON task_messages;
--> statement-breakpoint
CREATE TRIGGER touch_task_messages_updated_at
  BEFORE UPDATE ON task_messages FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint

-- 4. Owner Demotion & Deletion Protection Trigger
CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS TRIGGER AS $$
DECLARE
  owner_count INTEGER;
BEGIN
  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role <> 'owner') THEN
    SELECT COUNT(*) INTO owner_count
    FROM workspace_members
    WHERE workspace_id = OLD.workspace_id AND role = 'owner';

    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last remaining Owner. Transfer workspace ownership first.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS guard_last_owner ON workspace_members;
--> statement-breakpoint
CREATE TRIGGER guard_last_owner
  BEFORE UPDATE OR DELETE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();
--> statement-breakpoint

-- 5. Automated Profile Creation Trigger (auth.users -> public.profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Teammate'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

-- 6. Row-Level Security (RLS) & Realtime Publication
ALTER TABLE task_messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "Members can view task messages" ON task_messages;
--> statement-breakpoint
CREATE POLICY "Members can view task messages"
ON task_messages FOR SELECT TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);
--> statement-breakpoint
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
--> statement-breakpoint
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT TO authenticated
USING (recipient_id = auth.uid());
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'task_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
