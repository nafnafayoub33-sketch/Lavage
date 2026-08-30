/**
 * src/features/wash/WashApplicationForm.tsx
 *
 * The application form itself — four steps, shared by O1 (first submission)
 * and O2 (editing one already filed).
 *
 * It lives here rather than in the route because both screens render it, and
 * files under app/ are routes only. It owns which step is showing and
 * nothing else: the draft, and what to do with it, belong to the caller.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  isStepComplete,
  MAX_BAYS,
  MIN_PHOTOS,
  problemsForStep,
  WASH_APPLICATION_STEPS,
  type WashApplicationDraft,
  type WashApplicationProblem,
  type WashApplicationStep,
} from '@/core/usecases/washApplication';
import type { Coords } from '@/hooks/useLocation';
import { Button } from '@/ui/Button';
import { hitSize, numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { PhotoPicker } from './PhotoPicker';
import { PinPicker } from './PinPicker';

/**
 * Every problem string, in one place. A `Record` rather than a switch, so a
 * new problem in the usecase fails the typecheck here instead of rendering
 * as a blank line.
 */
export function useProblemMessage(): (problem: WashApplicationProblem) => string {
  const { t } = useTranslation();

  return (problem) => {
    const messages: Record<WashApplicationProblem, string> = {
      nameMissing: t('owner.problemNameMissing'),
      addressMissing: t('owner.problemAddressMissing'),
      cityMissing: t('owner.problemCityMissing'),
      pinMissing: t('owner.problemPinMissing'),
      pinOutsideMorocco: t('owner.problemPinOutsideMorocco'),
      tooFewPhotos: t('owner.problemTooFewPhotos', { count: MIN_PHOTOS }),
      tooManyPhotos: t('owner.problemTooManyPhotos'),
      baysOutOfRange: t('owner.problemBaysOutOfRange'),
      hoursIdentical: t('owner.problemHoursIdentical'),
    };
    return messages[problem];
  };
}

export function WashApplicationForm({
  draft,
  onChange,
  fallbackCentre,
  initialStep,
  submitLabel,
  submitting,
  submitDisabled,
  onSubmit,
}: {
  draft: WashApplicationDraft;
  onChange: (next: WashApplicationDraft) => void;
  /** the owner's own position, for a map with no pin on it yet */
  fallbackCentre: Coords | null;
  initialStep?: WashApplicationStep;
  submitLabel: string;
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const messageFor = useProblemMessage();

  const [step, setStep] = useState<WashApplicationStep>(initialStep ?? 'identity');

  const patch = (next: Partial<WashApplicationDraft>) => onChange({ ...draft, ...next });

  const stepProblems = problemsForStep(draft, step);
  const stepIndex = WASH_APPLICATION_STEPS.indexOf(step);
  const isLast = stepIndex === WASH_APPLICATION_STEPS.length - 1;
  const canAdvance = isStepComplete(draft, step);

  const jump = (next: WashApplicationStep) => {
    // Backwards is always allowed; forwards only past steps that are done,
    // or the review at the end would show gaps.
    const target = WASH_APPLICATION_STEPS.indexOf(next);
    if (target <= stepIndex) {
      setStep(next);
      return;
    }
    const earlierDone = WASH_APPLICATION_STEPS.slice(0, target).every((earlier) =>
      isStepComplete(draft, earlier),
    );
    if (earlierDone) setStep(next);
  };

  return (
    <View style={styles.wrap}>
      <StepBar current={step} draft={draft} onJump={jump} />

      {step === 'identity' ? (
        <View style={styles.form}>
          <Field
            label={t('owner.washName')}
            placeholder={t('owner.washNameHint')}
            value={draft.name}
            onChange={(name) => patch({ name })}
          />
          <Field
            label={t('owner.washDescription')}
            placeholder={t('owner.washDescriptionHint')}
            value={draft.description}
            onChange={(description) => patch({ description })}
            multiline
          />
          <Field
            label={t('owner.washPhone')}
            placeholder="+212"
            value={draft.phone}
            onChange={(phone) => patch({ phone })}
            keyboardType="phone-pad"
            numericStyle
          />
        </View>
      ) : null}

      {step === 'location' ? (
        <View style={styles.form}>
          <Field
            label={t('owner.washAddress')}
            placeholder={t('owner.washAddressHint')}
            value={draft.address}
            onChange={(address) => patch({ address })}
          />
          <Field
            label={t('owner.washCity')}
            placeholder={t('owner.washCity')}
            value={draft.city}
            onChange={(city) => patch({ city })}
          />

          <Text style={[type.caption, { color: c.textMuted }]}>{t('owner.pinHint')}</Text>
          <PinPicker
            value={draft.pin}
            fallbackCentre={fallbackCentre}
            onChange={(pin) => patch({ pin })}
          />
          <Text style={[type.caption, { color: c.textFaint }]}>{t('owner.pinHelp')}</Text>
        </View>
      ) : null}

      {step === 'photos' ? (
        <View style={styles.form}>
          <Text style={[type.caption, { color: c.textMuted }]}>{t('owner.photosWhy')}</Text>
          <PhotoPicker photos={draft.photos} onChange={(photos) => patch({ photos })} />
        </View>
      ) : null}

      {step === 'details' ? (
        <View style={styles.form}>
          <Text style={[type.label, { color: c.textMuted }]}>{t('owner.bays')}</Text>
          <Stepper
            value={draft.baysCount}
            min={1}
            max={MAX_BAYS}
            onChange={(baysCount) => patch({ baysCount })}
          />

          <View style={styles.hours}>
            <Field
              label={t('owner.opensAt')}
              placeholder="08:00"
              value={draft.opensAt}
              onChange={(opensAt) => patch({ opensAt })}
              numericStyle
            />
            <Field
              label={t('owner.closesAt')}
              placeholder="20:00"
              value={draft.closesAt}
              onChange={(closesAt) => patch({ closesAt })}
              numericStyle
            />
          </View>

          <Text style={[type.subtitle, { color: c.text }]}>{t('owner.reviewTitle')}</Text>
          <Review draft={draft} />
        </View>
      ) : null}

      {stepProblems.length > 0 ? (
        <View style={styles.problems}>
          {stepProblems.map((problem) => (
            <Text key={problem} style={[type.caption, { color: c.bad }]}>
              {messageFor(problem)}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        {isLast ? (
          <Button
            label={submitLabel}
            size="owner"
            disabled={!canAdvance || submitDisabled}
            loading={submitting}
            onPress={onSubmit}
          />
        ) : (
          <Button
            label={t('common.continue')}
            size="owner"
            disabled={!canAdvance}
            onPress={() => setStep(WASH_APPLICATION_STEPS[stepIndex + 1])}
          />
        )}

        {stepIndex > 0 ? (
          <Button
            label={t('common.back')}
            variant="ghost"
            size="owner"
            onPress={() => setStep(WASH_APPLICATION_STEPS[stepIndex - 1])}
          />
        ) : null}
      </View>
    </View>
  );
}

function StepBar({
  current,
  draft,
  onJump,
}: {
  current: WashApplicationStep;
  draft: WashApplicationDraft;
  onJump: (step: WashApplicationStep) => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const label: Record<WashApplicationStep, string> = {
    identity: t('owner.stepIdentity'),
    location: t('owner.stepLocation'),
    photos: t('owner.stepPhotos'),
    details: t('owner.stepDetails'),
  };

  return (
    <View style={styles.steps}>
      {WASH_APPLICATION_STEPS.map((step) => {
        const active = step === current;
        const done = isStepComplete(draft, step);

        return (
          <Pressable
            key={step}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onJump(step)}
            style={[
              styles.step,
              {
                backgroundColor: active ? c.primary : c.surface,
                borderColor: active ? c.primary : done ? c.ok : c.line,
              },
            ]}
          >
            <Text
              style={[type.caption, { color: active ? c.onPrimary : c.text }]}
              numberOfLines={1}
            >
              {label[step]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The last step doubles as the review — nothing is submitted unseen. */
function Review({ draft }: { draft: WashApplicationDraft }) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const rows: { label: string; value: string; latin?: boolean }[] = [
    { label: t('owner.washName'), value: draft.name },
    { label: t('owner.washAddress'), value: draft.address },
    { label: t('owner.washCity'), value: draft.city },
    { label: t('owner.stepPhotos'), value: String(draft.photos.length), latin: true },
    { label: t('owner.bays'), value: String(draft.baysCount), latin: true },
  ];

  return (
    <View style={[styles.review, { backgroundColor: c.surface, borderColor: c.line }]}>
      {rows.map((row) => (
        <View key={row.label} style={styles.reviewRow}>
          <Text style={[type.caption, { color: c.textMuted }]}>{row.label}</Text>
          <Text
            style={[type.body, row.latin === true ? numeric : null, { color: c.text }]}
            numberOfLines={1}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A plus/minus pair rather than a text field. Bays are a small integer and
 * this is owner-facing, so two 52px targets beat a keyboard.
 */
function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const { c } = useTheme();

  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="-"
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={[
          styles.stepperButton,
          {
            backgroundColor: c.surface,
            borderColor: c.line,
            opacity: value <= min ? 0.4 : 1,
          },
        ]}
      >
        <Text style={[type.subtitle, { color: c.text }]}>−</Text>
      </Pressable>

      <Text style={[type.counter, numeric, { color: c.text }]}>{value}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="+"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[
          styles.stepperButton,
          {
            backgroundColor: c.surface,
            borderColor: c.line,
            opacity: value >= max ? 0.4 : 1,
          },
        ]}
      >
        <Text style={[type.subtitle, { color: c.text }]}>+</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  multiline,
  keyboardType,
  numericStyle,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  keyboardType?: 'phone-pad';
  numericStyle?: boolean;
}) {
  const { c } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          type.body,
          numericStyle === true ? numeric : null,
          styles.input,
          multiline === true ? styles.inputTall : null,
          { backgroundColor: c.surface, borderColor: c.line, color: c.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { rowGap: spacing.md },
  steps: { flexDirection: 'row', columnGap: spacing.sm },
  step: {
    flex: 1,
    minHeight: hitSize.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  form: { rowGap: spacing.md },
  field: { flex: 1, rowGap: spacing.xs },
  input: {
    minHeight: hitSize.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputTall: {
    minHeight: hitSize.primary * 2,
    textAlignVertical: 'top',
    padding: spacing.lg,
  },
  hours: { flexDirection: 'row', columnGap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.lg },
  stepperButton: {
    minWidth: hitSize.primary,
    minHeight: hitSize.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  review: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.md,
  },
  reviewRow: { rowGap: spacing.xs },
  problems: { rowGap: spacing.xs },
  footer: { paddingTop: spacing.lg, rowGap: spacing.sm },
});
