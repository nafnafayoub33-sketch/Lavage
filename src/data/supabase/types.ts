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

/** 0001_init.sql — create type wash_status as enum (...) */
export type WashStatus = 'pending' | 'approved' | 'suspended' | 'closed';

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

/** 0001_init.sql — create type booking_status as enum (...) */
export type BookingStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'confirmed'
  | 'cancelled_client'
  | 'cancelled_owner'
  | 'no_show';

/** 0001_init.sql — create table bookings */
export type BookingRow = {
  id: string;
  car_wash_id: string;
  client_id: string;
  vehicle_id: string | null;
  service_id: string;
  status: BookingStatus;
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
        Insert: Omit<CarWashRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<CarWashRow>;
        Relationships: [];
      };
      services: {
        Row: ServiceRow;
        Insert: Omit<ServiceRow, 'id'> & { id?: string };
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
        Insert: Omit<BookingRow, 'id' | 'ticket_no' | 'created_at'> & {
          id?: string;
          // assigned by the set_ticket_no trigger, never by the client
          ticket_no?: number;
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
    };
    Enums: {
      user_role: UserRole;
      wash_status: WashStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
