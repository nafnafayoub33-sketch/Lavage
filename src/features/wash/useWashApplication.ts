/**
 * src/features/wash/useWashApplication.ts
 *
 * O1's form, and O2's edit of the same form.
 *
 * Submitting is three round trips that have to happen in order, because none
 * of them can be done earlier:
 *
 *   1. register_car_wash  — creates the row and returns its id
 *   2. upload each photo  — to wash-photos/<id>/, which needs that id
 *   3. set_wash_media     — attaches the resulting URLs to the row
 *
 * A failure at step 2 or 3 leaves a registered wash with no photos rather
 * than nothing at all, which is why the screen's next stop is O2: the owner
 * can see what was filed and fix it. Rolling the row back would be worse —
 * it would throw away the part that succeeded and re-open the "you already
 * have an application" case on the retry.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { WashApplicationDraft } from '@/core/usecases/washApplication';
import { uploadWashPhoto, isUploaded } from '@/data/repositories/StorageRepository';
import {
  getMyWash,
  getWashPin,
  registerWash,
  resubmitWash,
  setWashMedia,
  updateWash,
} from '@/data/repositories/WashRepository';

export const EMPTY_DRAFT: WashApplicationDraft = {
  name: '',
  description: '',
  address: '',
  city: '',
  phone: '',
  pin: null,
  photos: [],
  baysCount: 1,
  opensAt: '08:00',
  closesAt: '20:00',
};

/**
 * Uploads whatever is still a local file and returns the full list of public
 * URLs, in the order the owner arranged them. Already-uploaded entries pass
 * through untouched, so re-saving an edit does not duplicate every photo.
 */
async function uploadNewPhotos(
  washId: string,
  photos: readonly string[],
): Promise<string[]> {
  const urls: string[] = [];

  for (const photo of photos) {
    if (isUploaded(photo)) {
      urls.push(photo);
      continue;
    }

    const result = await uploadWashPhoto(washId, photo);
    if (!result.ok) throw new Error(result.reason);
    urls.push(result.value);
  }

  return urls;
}

export function useWashApplication() {
  const queryClient = useQueryClient();

  const washQuery = useQuery({
    queryKey: ['myWash'],
    queryFn: async () => {
      const result = await getMyWash();
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const wash = washQuery.data ?? null;
  const washId = wash?.id ?? null;

  // The pin is not on the row in any usable form — location is a PostGIS
  // geography, opaque to PostgREST — so it is a separate read.
  const pinQuery = useQuery({
    queryKey: ['washPin', washId],
    enabled: washId !== null,
    queryFn: async () => {
      if (washId === null) return null;
      const result = await getWashPin(washId);
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const [draft, setDraft] = useState<WashApplicationDraft>(EMPTY_DRAFT);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Fill the form from the existing wash, once per wash. Re-filling on every
  // render of the query would wipe whatever the owner is typing the moment
  // anything refetched.
  useEffect(() => {
    if (wash === null || washId === null) return;
    if (loadedFor === washId) return;
    if (pinQuery.isPending) return;

    setDraft({
      name: wash.name,
      description: wash.description ?? '',
      address: wash.address,
      city: wash.city,
      phone: wash.phone ?? '',
      pin: pinQuery.data ?? null,
      photos: wash.photos,
      baysCount: wash.bays_count,
      // Postgres hands back 'HH:MM:SS'; the form fields hold 'HH:MM'.
      opensAt: wash.opens_at.slice(0, 5),
      closesAt: wash.closes_at.slice(0, 5),
    });
    setLoadedFor(washId);
  }, [wash, washId, loadedFor, pinQuery.isPending, pinQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['myWash'] });
    void queryClient.invalidateQueries({ queryKey: ['washPin'] });
  };

  /** O1 — the first submission. */
  const submit = useMutation({
    mutationFn: async (application: WashApplicationDraft) => {
      if (application.pin === null) throw new Error('no pin');

      const registered = await registerWash({
        name: application.name.trim(),
        description: application.description.trim() === ''
          ? null
          : application.description.trim(),
        address: application.address.trim(),
        city: application.city.trim(),
        phone: application.phone.trim() === '' ? null : application.phone.trim(),
        latitude: application.pin.latitude,
        longitude: application.pin.longitude,
        baysCount: application.baysCount,
        opensAt: application.opensAt,
        closesAt: application.closesAt,
      });
      if (!registered.ok) throw new Error(registered.reason);

      const urls = await uploadNewPhotos(registered.value, application.photos);

      const attached = await setWashMedia(registered.value, { photos: urls });
      if (!attached.ok) throw new Error(attached.reason);

      return registered.value;
    },
    onSuccess: invalidate,
  });

  /** O2 — editing an application that is already filed. */
  const save = useMutation({
    mutationFn: async (application: WashApplicationDraft) => {
      if (washId === null) throw new Error('no wash');
      if (application.pin === null) throw new Error('no pin');

      const updated = await updateWash(washId, {
        name: application.name.trim(),
        description: application.description.trim() === ''
          ? null
          : application.description.trim(),
        address: application.address.trim(),
        phone: application.phone.trim() === '' ? null : application.phone.trim(),
        baysCount: application.baysCount,
        opensAt: application.opensAt,
        closesAt: application.closesAt,
      });
      if (!updated.ok) throw new Error(updated.reason);

      const urls = await uploadNewPhotos(washId, application.photos);

      const media = await setWashMedia(washId, {
        photos: urls,
        latitude: application.pin.latitude,
        longitude: application.pin.longitude,
      });
      if (!media.ok) throw new Error(media.reason);
    },
    onSuccess: () => {
      // The form is now behind the server again, so let it reload.
      setLoadedFor(null);
      invalidate();
    },
  });

  /** O2 — "Submit again" after a rejection. */
  const resubmit = useMutation({
    mutationFn: async () => {
      if (washId === null) throw new Error('no wash');
      const result = await resubmitWash(washId);
      if (!result.ok) throw new Error(result.reason);
    },
    onSuccess: invalidate,
  });

  return {
    wash,
    washId,
    draft,
    setDraft,
    isLoading: washQuery.isPending || (washId !== null && pinQuery.isPending),
    isError: washQuery.isError,
    refetch: () => {
      void washQuery.refetch();
      void pinQuery.refetch();
    },
    submit,
    save,
    resubmit,
  };
}
