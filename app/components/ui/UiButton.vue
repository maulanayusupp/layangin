<script setup lang="ts">
/**
 * The only button in the project.
 *
 * Renders a `<button>` by default, or a `<NuxtLink>` when `to` is given, so
 * navigation stays a real link (middle-click, open-in-new-tab, focus order) and
 * actions stay real buttons.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    /** Internal route. Pass an already-localised path. */
    to?: string
    /** External URL. Opens in a new tab with the right rel attributes. */
    href?: string
    type?: 'button' | 'submit'
    disabled?: boolean
    /** Stretch to the container width. */
    block?: boolean
    /** Adds a pulsing ring to draw the eye to the primary action. */
    pulse?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    to: undefined,
    href: undefined,
    disabled: false,
    block: false,
    pulse: false,
  },
)

const { t } = useI18n()

const isExternal = computed(() => Boolean(props.href))
const tag = computed(() => {
  if (props.href) return 'a'
  if (props.to) return resolveComponent('NuxtLink')
  return 'button'
})
</script>

<template>
  <component
    :is="tag"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block, 'btn--pulse': pulse && !disabled }]"
    :to="to"
    :href="href"
    :type="tag === 'button' ? type : undefined"
    :disabled="tag === 'button' ? disabled : undefined"
    :aria-disabled="tag !== 'button' && disabled ? 'true' : undefined"
    :target="isExternal ? '_blank' : undefined"
    :rel="isExternal ? 'noopener noreferrer' : undefined"
  >
    <span
      v-if="$slots.icon"
      class="btn__icon"
      aria-hidden="true"
    >
      <slot name="icon" />
    </span>
    <span class="btn__label"><slot /></span>
    <span
      v-if="isExternal"
      class="visually-hidden"
    > ({{ t('a11y.external') }})</span>
  </component>
</template>

<style scoped lang="scss">
.btn {
  --btn-bg: var(--c-surface-strong);
  --btn-fg: var(--c-text);
  --btn-border: var(--c-border);

  display: inline-flex;
  gap: var(--sp-2);
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  color: var(--btn-fg);
  border: 1px solid var(--btn-border);
  background: var(--btn-bg);
  transition:
    translate var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);

  // Kite-notched corner: the shape used across every surface in the project.
  @include notched(11px, 'tr');
  @include tap-target;
  @include focus-visible;

  @include hover {
    translate: 0 rem(-1);
  }

  &:active:not(:disabled) {
    translate: 0 rem(1);
  }

  &:disabled,
  &[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.45;
    translate: none;
  }
}

.btn--sm {
  padding: rem(7) var(--sp-3);
  font-size: var(--fs-sm);
}

.btn--md {
  padding: rem(11) var(--sp-4);
  font-size: var(--fs-base);
}

.btn--lg {
  padding: rem(15) var(--sp-5);
  font-size: var(--fs-md);
}

.btn--primary {
  --btn-fg: var(--c-text-on-brand);
  --btn-border: transparent;

  background: var(--g-brand);

  @include hover {
    box-shadow: var(--sh-glow-brand);
  }
}

.btn--gold {
  --btn-fg: #2a1c00;
  --btn-border: transparent;

  background: var(--g-gold);
}

.btn--secondary {
  --btn-bg: color-mix(in srgb, var(--c-brand) 12%, transparent);
  --btn-fg: var(--c-brand-soft);
  --btn-border: color-mix(in srgb, var(--c-brand) 40%, transparent);

  @include hover {
    --btn-bg: color-mix(in srgb, var(--c-brand) 20%, transparent);
  }
}

.btn--ghost {
  --btn-bg: transparent;
  --btn-fg: var(--c-text-soft);
  --btn-border: var(--c-hairline);

  @include hover {
    --btn-fg: var(--c-text);
    --btn-border: var(--c-border-strong);
  }
}

.btn--danger {
  --btn-bg: color-mix(in srgb, var(--c-danger) 14%, transparent);
  --btn-fg: #ffc9cf;
  --btn-border: color-mix(in srgb, var(--c-danger) 45%, transparent);

  @include hover {
    --btn-bg: color-mix(in srgb, var(--c-danger) 24%, transparent);
  }
}

.btn--block {
  width: 100%;
}

.btn--pulse {
  animation: pulse-ring 2.4s var(--ease-out) infinite;

  @include reduced-motion {
    animation: none;
  }
}

.btn__icon {
  display: inline-flex;
  flex: none;
}
</style>
