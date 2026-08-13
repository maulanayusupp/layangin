<script setup lang="ts">
/**
 * Dismissible tip callout used to teach the game without a forced tutorial.
 *
 * Dismissal is remembered per `hintId` in the settings store, so a player is not
 * told the same thing on every visit — and "show tips again" in the shop restores
 * all of them.
 */
const props = withDefaults(
  defineProps<{
    /** Stable id used to remember dismissal. */
    hintId: string
    tone?: 'info' | 'warning'
    /** Cannot be dismissed — for genuinely important notes. */
    persistent?: boolean
  }>(),
  { tone: 'info', persistent: false },
)

const { t } = useI18n()
const settings = useSettingsStore()

// Rendered only after hydration for dismissible hints: the dismissed list lives
// in localStorage, and rendering it during SSR would flash a hint the player
// already dismissed.
const visible = computed(() => {
  if (props.persistent) return true
  if (!settings.hydrated) return false
  return !settings.isHintDismissed(props.hintId)
})
</script>

<template>
  <aside
    v-if="visible"
    class="hint"
    :class="`hint--${tone}`"
  >
    <span
      class="hint__marker"
      aria-hidden="true"
    />

    <div class="hint__body">
      <p class="hint__label">
        {{ t('hint.label') }}
      </p>
      <p class="hint__text">
        <slot />
      </p>
    </div>

    <button
      v-if="!persistent"
      type="button"
      class="hint__dismiss"
      @click="settings.dismissHint(hintId)"
    >
      {{ t('hint.dismiss') }}
    </button>
  </aside>
</template>

<style scoped lang="scss">
.hint {
  --hint-tone: var(--c-sky);

  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--sp-3);
  align-items: start;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid color-mix(in srgb, var(--hint-tone) 32%, transparent);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--hint-tone) 8%, transparent);

  @include mq('sm') {
    grid-template-columns: auto 1fr auto;
    align-items: center;
  }
}

.hint--warning {
  --hint-tone: var(--c-warn);
}

.hint__marker {
  width: rem(9);
  height: rem(9);
  margin-block-start: rem(6);
  background: var(--hint-tone);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);

  @include mq('sm') {
    margin-block-start: 0;
  }
}

.hint__label {
  font-family: var(--font-mono);
  font-size: rem(10);
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--hint-tone);
}

.hint__text {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.hint__dismiss {
  grid-column: 2;
  justify-self: start;
  padding: rem(5) var(--sp-3);
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--c-text-mute);
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-pill);

  @include focus-visible(2px);

  @include hover {
    color: var(--c-text);
    border-color: var(--c-border-strong);
  }

  @include mq('sm') {
    grid-column: auto;
  }
}
</style>
