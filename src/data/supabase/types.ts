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

/**
 * 0001_init.sql — create type wash_status as enum (...)
 * 0012_wash_review.sql adds 'rejected': never went live, as opposed to
 * 'suspended', which was live and was stopped.
 */
export type WashStatus = 'pending' | 'approved' | 'suspended' | 'closed' | 'rejected';

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

/**
 * 0001_init.sql — create table car_washes.
 * `location` is a PostGIS geography; generated types leave it opaque and so
 * does this. Query it through the RPCs (nearby_car_washes), never directly.
 */
export type CarWashRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  location: unknown;
  phone: string | null;
  photos: string[];
  bays_count: number;
  opens_at: string;
  closes_at: string;
  status: WashStatus;
  is_open_now: boolean;
  credit_balance: number;
  free_washes_left: number;
  rating_avg: number;
  rating_count: number;
  cancel_rate: number;
  created_at: string;
  /** 0012 — the admin's reason, shown to the owner on O2. Null once approved. */
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

/** 0001_init.sql — create table services */
export type ServiceRow = {
  id: string;
  car_wash_id: string;
  name: string;
  price: number;
  duration_min: number;
  vehicle_type: string;
  is_active: boolean;
};

/**
 * 0006_queue_events.sql — one summary row per wash, so Realtime can tell a
 * client the queue moved. RLS on bookings makes that impossible to learn
 * from bookings directly.
 */
export type QueueEventRow = {
  car_wash_id: string;
  cars_waiting: number;
  now_serving: number | null;
  updated_at: string;
};

/** 0001_init.sql — create type booking_status as enum (...) */
export type BookingStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'confirmed'
  | 'cancelled_client'
  | 'cancelled_owner'
  | 'no_show';

/** 0008 — the client's word about whether they are coming. Null = not said. */
export type ArrivalStatus = 'on_the_way' | 'arrived';

/** 0001_init.sql — create table bookings */
export type BookingRow = {
  id: string;
  car_wash_id: string;
  /** null for a walk-in; walkin_label carries the name instead */
  client_id: string | null;
  walkin_label: string | null;
  vehicle_id: string | null;
  service_id: string;
  status: BookingStatus;
  arrival: ArrivalStatus | null;
  price: number;
  payment_method: 'cash' | 'card' | 'wallet';
  ticket_no: number;
  estimated_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

/**
 * The statuses that mean "this client is currently in a queue somewhere".
 * 0001 enforces one at a time per client with a partial unique index, so a
 * query filtered on these can safely expect at most one row.
 */
export const ACTIVE_BOOKING_STATUSES = ['pending', 'in_progress', 'done'] as const;

/** 0009_manual_topup.sql */
export type TopupStatus = 'pending' | 'approved' | 'rejected';

export type TopupRequestRow = {
  id: string;
  car_wash_id: string;
  amount: number;
  reference: string;
  receipt_url: string | null;
  status: TopupStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

/** 0001_init.sql — create table credit_transactions */
export type CreditTransactionRow = {
  id: string;
  car_wash_id: string;
  type: 'topup' | 'charge' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  booking_id: string | null;
  note: string | null;
  created_at: string;
};

/** 0001_init.sql — create table platform_settings */
export type PlatformSettingRow = {
  key: string;
  value: unknown;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      car_washes: {
        Row: CarWashRow;
        // The review columns are written only by the 0012 RPCs, and the guard
        // trigger refuses them from anyone else — so they are not insertable.
        Insert: Omit<
          CarWashRow,
          'id' | 'created_at' | 'review_note' | 'reviewed_at' | 'reviewed_by'
        > & { id?: string; created_at?: string };
        Update: Partial<CarWashRow>;
        Relationships: [];
      };
      queue_events: {
        Row: QueueEventRow;
        // Written only by the refresh_queue_event trigger; no client inserts.
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'queue_events_car_wash_id_fkey';
            columns: ['car_wash_id'];
            isOneToOne: true;
            referencedRelation: 'car_washes';
            referencedColumns: ['id'];
          },
        ];
      };
      topup_requests: {
        Row: TopupRequestRow;
        // status and admin_note are refused by RLS on insert; the owner only
        // ever files a pending request.
        Insert: {
          car_wash_id: string;
          amount: number;
          reference: string;
          receipt_url?: string | null;
          id?: string;
        };
        Update: Partial<TopupRequestRow>;
        Relationships: [];
      };
      credit_transactions: {
        Row: CreditTransactionRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      platform_settings: {
        Row: PlatformSettingRow;
        Insert: PlatformSettingRow;
        Update: Partial<PlatformSettingRow>;
        Relationships: [];
      };
      services: {
        Row: ServiceRow;
        // vehicle_type and is_active have defaults in 0001, so they are
        // optional on insert even though the column is NOT NULL.
        Insert: Omit<ServiceRow, 'id' | 'vehicle_type' | 'is_active'> & {
          id?: string;
          vehicle_type?: string;
          is_active?: boolean;
        };
        Update: Partial<ServiceRow>;
        Relationships: [
          {
            foreignKeyName: 'services_car_wash_id_fkey';
            columns: ['car_wash_id'];
            isOneToOne: false;
            referencedRelation: 'car_washes';
            referencedColumns: ['id'];
          },
        ];
      };
      bookings: {
        Row: BookingRow;
        // Only the four columns a caller genuinely supplies are required.
        // Everything else is defaulted by 0001, nullable, or written by a
        // trigger — ticket_no by set_ticket_no, price and arrival by
        // guard_booking_insert.
        Insert: {
          car_wash_id: string;
          service_id: string;
          client_id?: string | null;
          walkin_label?: string | null;
          vehicle_id?: string | null;
          status?: BookingStatus;
          arrival?: ArrivalStatus | null;
          price?: number;
          payment_method?: 'cash' | 'card' | 'wallet';
          id?: string;
          ticket_no?: number;
          estimated_at?: string | null;
          created_at?: string;
        };
        Update: Partial<BookingRow>;
        Relationships: [
          {
            foreignKeyName: 'bookings_car_wash_id_fkey';
            columns: ['car_wash_id'];
            isOneToOne: false;
            referencedRelation: 'car_washes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** 0002_is_phone_blocked.sql */
      is_phone_blocked: {
        Args: { p_phone: string };
        Returns: boolean;
      };
      /** 0004_nearby_car_washes_price_and_open.sql — backs C1 */
      nearby_car_washes: {
        Args: { p_lat: number; p_lng: number; p_radius_m?: number };
        Returns: {
          id: string;
          name: string;
          address: string;
          photos: string[];
          latitude: number;
          longitude: number;
          distance_m: number;
          rating_avg: number;
          rating_count: number;
          bays_count: number;
          cars_ahead: number;
          wait_minutes: number;
          price_from: number | null;
          is_open: boolean;
        }[];
      };
      /** 0005_queue_state_security_definer.sql — C6 */
      my_queue_position: {
        Args: { p_booking_id: string };
        Returns: {
          cars_ahead: number;
          wait_minutes: number;
          now_serving: number | null;
        }[];
      };
      /** 0009_manual_topup.sql — D8 approves a bank transfer */
      approve_topup: {
        Args: { p_request_id: string; p_note?: string | null };
        Returns: undefined;
      };
      reject_topup: {
        Args: { p_request_id: string; p_note: string };
        Returns: undefined;
      };
      /** 0012_wash_review.sql — D2's queue. Admin only; others get zero rows. */
      pending_washes: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          address: string;
          city: string;
          phone: string | null;
          photos: string[];
          bays_count: number;
          opens_at: string;
          closes_at: string;
          latitude: number;
          longitude: number;
          created_at: string;
          owner_name: string;
          owner_phone: string | null;
          service_count: number;
        }[];
      };
      /** 0012_wash_review.sql — D2 decides */
      approve_wash: {
        Args: { p_wash_id: string };
        Returns: undefined;
      };
      reject_wash: {
        Args: { p_wash_id: string; p_reason: string };
        Returns: undefined;
      };
      /** 0012_wash_review.sql — O2's "Submit again" */
      resubmit_wash: {
        Args: { p_wash_id: string };
        Returns: undefined;
      };
      /** 0007_owner_queue.sql — backs O3 */
      owner_queue: {
        Args: { p_wash_id: string };
        Returns: {
          booking_id: string;
          ticket_no: number;
          status: BookingStatus;
          arrival: ArrivalStatus | null;
          price: number;
          created_at: string;
          started_at: string | null;
          service_name: string;
          service_minutes: number;
          client_first_name: string | null;
          client_phone: string | null;
          walkin_label: string | null;
          vehicle_label: string | null;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      wash_status: WashStatus;
      arrival_status: ArrivalStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
