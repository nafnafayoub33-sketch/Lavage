/**
 * src/data/repositories/StorageRepository.ts
 *
 * Uploads, and the public URLs that come back.
 *
 * The path layout is a contract, not a convention: 0013's policies key off
 * the first two segments, so a file put anywhere else is refused by the
 * database rather than landing somewhere unreachable. The helpers here are
 * the only place those paths are built.
 */
import { supabase } from '@/data/supabase/client';

import type { AuthResult } from './AuthRepository';

/** Public read. Avatars and wash photos. */
const PUBLIC_BUCKET = 'media';
/** No public read at all. Receipts, reached through a signed URL. */
const PRIVATE_BUCKET = 'private';

/** How long a receipt link stays good for. Long enough to look at, not to share. */
const SIGNED_URL_SECONDS = 60 * 10;

/**
 * React Native has no File and no Blob worth relying on, so an upload reads
 * the local URI through fetch() and sends an ArrayBuffer. supabase-js accepts
 * one directly as long as the content type is given.
 */
async function readLocalFile(
  uri: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;

    const body = await response.arrayBuffer();
    // The picker hands back image/jpeg for camera shots; a URI with no type
    // at all is still an image, and jpeg is the safe assumption.
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    return { body, contentType };
  } catch {
    return null;
  }
}

function extensionOf(uri: string): string {
  const match = /\.(jpe?g|png|webp|heic)(\?|$)/i.exec(uri);
  return match === null ? 'jpg' : match[1].toLowerCase();
}

/**
 * A wash photo. `localUri` is what the picker returned; the resolved value is
 * the **public URL**, which is what car_washes.photos holds and what every
 * screen renders directly.
 */
export async function uploadWashPhoto(
  washId: string,
  localUri: string,
): Promise<AuthResult<string>> {
  const file = await readLocalFile(localUri);
  if (file === null) return { ok: false, reason: 'unknown' };

  // Name collisions would silently overwrite a photo the owner just added,
  // so the name carries the time and a random tail rather than an index.
  const path = `wash-photos/${washId}/${Date.now()}-${randomTail()}.${extensionOf(localUri)}`;

  const { error } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(path, file.body, { contentType: file.contentType, upsert: false });

  if (error) return { ok: false, reason: 'unknown' };

  const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
  return { ok: true, value: data.publicUrl };
}

/** A6's avatar. Same bucket, its own folder, keyed by the user rather than a wash. */
export async function uploadAvatar(
  userId: string,
  localUri: string,
): Promise<AuthResult<string>> {
  const file = await readLocalFile(localUri);
  if (file === null) return { ok: false, reason: 'unknown' };

  // One avatar per person: upsert, so changing it does not leave the old one
  // behind for nobody.
  const path = `avatars/${userId}/avatar.${extensionOf(localUri)}`;

  const { error } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(path, file.body, { contentType: file.contentType, upsert: true });

  if (error) return { ok: false, reason: 'unknown' };

  const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
  return { ok: true, value: data.publicUrl };
}

/**
 * O7's transfer receipt. Returns the storage **path**, not a URL — the
 * bucket is not public, so there is no URL to hand out. The path is what
 * topup_requests.receipt_url stores and what signedReceiptUrl() resolves.
 */
export async function uploadReceipt(
  washId: string,
  localUri: string,
): Promise<AuthResult<string>> {
  const file = await readLocalFile(localUri);
  if (file === null) return { ok: false, reason: 'unknown' };

  const path = `receipts/${washId}/${Date.now()}-${randomTail()}.${extensionOf(localUri)}`;

  const { error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(path, file.body, { contentType: file.contentType, upsert: false });

  if (error) return { ok: false, reason: 'unknown' };
  return { ok: true, value: path };
}

/** D8 and O7 both view a receipt; neither can link to one directly. */
export async function signedReceiptUrl(path: string): Promise<AuthResult<string>> {
  const { data, error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (error || data === null) return { ok: false, reason: 'unknown' };
  return { ok: true, value: data.signedUrl };
}

/**
 * Removing a photo the owner dropped from the form. Best effort: the row is
 * the source of truth for what is shown, so a file left behind is wasted
 * space rather than a visible bug, and failing the save over it would be
 * worse than leaking a few kilobytes.
 */
export async function deleteWashPhoto(publicUrl: string): Promise<void> {
  const path = pathFromPublicUrl(publicUrl);
  if (path === null) return;

  const { error } = await supabase.storage.from(PUBLIC_BUCKET).remove([path]);
  if (error) console.warn('[storage] could not remove a dropped photo', error.message);
}

/**
 * A public URL is `<project>/storage/v1/object/public/<bucket>/<path>`, so
 * the path is whatever follows the bucket name. Returns null for anything
 * that is not one of ours — including the local file URIs that are still in
 * the form before a save.
 */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${PUBLIC_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  return url.slice(at + marker.length);
}

/** Distinguishes a photo already uploaded from one the picker just returned. */
export function isUploaded(uri: string): boolean {
  return pathFromPublicUrl(uri) !== null;
}

function randomTail(): string {
  return Math.random().toString(36).slice(2, 10);
}
