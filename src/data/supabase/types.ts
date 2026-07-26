/**
 * src/data/supabase/types.ts
 *
 * Generated database types. This is a placeholder until the Supabase project
 * exists — the schema itself already lives in
 * supabase/migrations/0001_init.sql.
 *
 * Regenerate with:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public \
 *     > src/data/supabase/types.ts
 *
 * Do not hand-edit the generated output. Until then the client is typed
 * against an empty schema, which keeps `createClient<Database>()` honest
 * without pretending we know the row shapes.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
