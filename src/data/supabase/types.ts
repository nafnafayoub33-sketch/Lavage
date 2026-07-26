/**
 * src/data/supabase/types.ts
 *
 * Database types.
 *
 * These are hand-written for the tables and functions the app actually
 * queries today, transcribed from supabase/migrations/*.sql. Once the
 * Supabase project exists, replace the whole file with generated output:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public \
 *     > src/data/supabase/types.ts
 *
 * Anything not listed here simply is not queried yet. Add the table when the
 * screen that needs it lands, or generate the file and stop hand-writing.
 */

/** 0001_init.sql — create type user_role as enum ('admin', 'owner', 'client') */
export type UserRole = 'admin' | 'owner' | 'client';

/** 0001_init.sql — create table profiles */
export type ProfileRow = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  no_show_count: number;
  is_blocked: boolean;
  created_at: string;
};

type ProfileInsert = {
  id: string;
  role?: UserRole;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  no_show_count?: number;
  is_blocked?: boolean;
  created_at?: string;
};

type ProfileUpdate = Partial<ProfileInsert>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** 0002_is_phone_blocked.sql */
      is_phone_blocked: {
        Args: { p_phone: string };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
