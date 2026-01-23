import { createClient } from '@supabase/supabase-js';

// Client for browser (uses anon key)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client for server/scripts (uses service role key)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
export interface Score {
  id: string;
  team_name: string;
  repo: string;
  track: number;
  problem: number;
  solution: number;
  execution: number;
  total: number;
  lines_of_code: number;
  commentary: string | null;
  last_updated: string;
  created_at: string;
}

export interface Photo {
  id: string;
  team_name: string;
  email: string | null;
  image_url: string;
  created_at: string;
}

export interface QueueItem {
  id: string;
  team_name: string;
  status: 'waiting' | 'displaying' | 'done';
  created_at: string;
  displayed_at: string | null;
}
