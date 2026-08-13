<script setup lang="ts">
/**
 * Horizontal gauge for line condition, stamina, load and stat ratings.
 *
 * The fill is driven by a CSS custom property set through `v-css-vars` — the
 * project's one sanctioned mechanism for runtime values — so the template stays
 * free of inline styling and every visual rule lives in this stylesheet.
 *
 * Uses `role="meter"` with the full ARIA value set, so the reading is available
 * to assistive technology without depending on the bar's width.
 */
const props = withDefaults(
  defineProps<{
    /** 0..1 */
    value: number
    label: string
    /** Text shown next to the label, e.g. "82 N". Defaults to a percentage. */
    display?: string
    tone?: 'brand' | 'gold' | 'sky' | 'success' | 'danger' | 'neutral'
    size?: 'sm' | 'md'
    /** Fraction 0..1 at which a warning mark is drawn, e.g. the overload point. */
    threshold?: number
    /** Turn the bar red once `threshold` is exceeded. */
    warnPastThreshold?: boolean
    /** Hide the label row; the label is still announced. */
    compact?: boolean
  }>(),
  {
    display: undefined,
    tone: 'brand',
    size: 'md',
    threshold: undefined,
    warnPastThreshold: false,
    compact: false,
  },
)

const { locale } = useI18n()

const ratio = computed(() => Math.max(0, Math.min(1, props.value)))
const readout = computed(() => props.display ?? formatPercent(ratio.value, locale.value))
const warning = computed(
  () => props.warnPastThreshold && props.threshold !== undefined && ratio.value > props.threshold,
)
</script>

<template>
  <div
    class="meter"
    :class="[`meter--${size}`, { 'meter--warning': warning }]"
  >
    <div
      v-if="!compact"
      class="meter__head"
    >
      <span class="meter__label">{{ label }}</span>
      <span class="meter__value t-num">{{ readout }}</span>
    </div>

    <div
      v-css-vars="{ fill: ratio, mark: threshold ?? 0 }"
      class="meter__track"
      :class="`meter__track--${tone}`"
      role="meter"
      :aria-valuenow="Math.round(ratio * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label"
      :aria-valuetext="readout"
    >
      <span class="meter__fill" />
      <span
        v-if="threshold !== undefined"
        class="meter__mark"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.meter {
  display: grid;
  gap: rem(5);
}

.meter__head {
  display: flex;
  gap: var(--sp-3);
  align-items: baseline;
  justify-content: space-between;
}

.meter__label {
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--c-text-mute);
}

.meter__value {
  font-size: var(--fs-xs);
  color: var(--c-text-soft);
}

.meter__track {
  --meter-tone: var(--c-brand);
  --meter-gradient: var(--g-brand);

  position: relative;
  overflow: hidden;
  height: rem(8);
  border-radius: var(--r-pill);
  background: var(--c-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--c-hairline);
}

.meter--sm .meter__track {
  height: rem(5);
}

.meter__fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  // `--fill` is supplied by v-css-vars as a 0..1 number.
  scale: var(--fill, 0) 1;
  border-radius: inherit;
  background: var(--meter-gradient);
  transition: scale var(--dur-fast) linear;

  @include reduced-motion {
    transition: none;
  }
}

.meter__mark {
  position: absolute;
  inset-block: rem(-2);
  // `--mark` is a 0..1 fraction of the track width.
  inset-inline-start: calc(var(--mark, 0) * 100%);
  width: rem(2);
  background: var(--c-text);
  opacity: 0.55;
}

.meter__track--gold {
  --meter-gradient: var(--g-gold);
}

.meter__track--sky {
  --meter-gradient: var(--g-sky);
}

.meter__track--success {
  --meter-gradient: linear-gradient(90deg, #2aa862, var(--c-success));
}

.meter__track--danger {
  --meter-gradient: linear-gradient(90deg, #b31d2c, var(--c-danger));
}

.meter__track--neutral {
  --meter-gradient: linear-gradient(90deg, var(--c-ink-400), var(--c-text-mute));
}

/// Overload state wins over the configured tone.
.meter--warning .meter__track {
  --meter-gradient: linear-gradient(90deg, #b31d2c, var(--c-danger));

  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-danger) 55%, transparent);
}

.meter--warning .meter__value {
  color: var(--c-danger);
}
</style>
