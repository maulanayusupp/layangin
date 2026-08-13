<script setup lang="ts">
/**
 * Wizard progress rail.
 *
 * An ordered list of steps with the current one marked, plus buttons back to any
 * step already completed — forward is blocked until the step before it is done,
 * which is what makes it a wizard rather than a tab bar.
 *
 * Rendered as a real `<ol>` so the sequence is conveyed structurally, with
 * `aria-current="step"` on the active one.
 */
export interface WizardStep {
  key: string
  label: string
  /** Short summary of what has been chosen, shown under the label. */
  value?: string
}

const props = defineProps<{
  steps: WizardStep[]
  /** 0-based index of the active step. */
  current: number
}>()

const emit = defineEmits<{ go: [index: number] }>()

function canGo(index: number): boolean {
  // Backwards always; forwards only to the step immediately ahead.
  return index <= props.current
}
</script>

<template>
  <nav class="steps">
    <ol class="steps__list">
      <li
        v-for="(step, index) in steps"
        :key="step.key"
        class="steps__item"
        :class="{
          'is-current': index === current,
          'is-done': index < current,
        }"
      >
        <button
          type="button"
          class="steps__button"
          :disabled="!canGo(index)"
          :aria-current="index === current ? 'step' : undefined"
          @click="emit('go', index)"
        >
          <span
            class="steps__marker"
            aria-hidden="true"
          >
            <span v-if="index < current">✓</span>
            <span
              v-else
              class="t-num"
            >{{ index + 1 }}</span>
          </span>

          <span class="steps__text">
            <span class="steps__label">{{ step.label }}</span>
            <span
              v-if="step.value"
              class="steps__value"
            >{{ step.value }}</span>
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped lang="scss">
.steps__list {
  display: grid;
  gap: var(--sp-2);

  @include mq('sm') {
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: var(--sp-3);
  }
}

.steps__item {
  position: relative;
}

.steps__button {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  width: 100%;
  padding: var(--sp-3);
  text-align: start;
  border: 1px solid var(--c-hairline);
  background: var(--c-surface-sunken);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);

  @include notched(11px, 'tr');
  @include focus-visible(2px);

  &:disabled {
    cursor: default;
    opacity: 0.55;
  }

  @include hover {
    &:not(:disabled) {
      border-color: var(--c-border-strong);
    }
  }
}

.steps__item.is-current .steps__button {
  border-color: color-mix(in srgb, var(--c-brand) 65%, transparent);
  background: color-mix(in srgb, var(--c-brand) 10%, transparent);
}

.steps__marker {
  display: grid;
  flex: none;
  place-items: center;
  width: rem(26);
  height: rem(26);
  font-family: var(--font-mono);
  font-size: rem(11);
  font-weight: 700;
  color: var(--c-text-mute);
  border: 1px solid var(--c-border);
  border-radius: 50%;
}

.steps__item.is-current .steps__marker {
  color: var(--c-text-on-brand);
  border-color: transparent;
  background: var(--g-brand);
}

.steps__item.is-done .steps__marker {
  color: #04241f;
  border-color: transparent;
  background: var(--c-success);
}

.steps__text {
  display: grid;
  gap: rem(1);
  min-width: 0;
}

.steps__label {
  font-family: var(--font-display);
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-text);
}

.steps__value {
  overflow: hidden;
  font-size: var(--fs-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--c-text-mute);
}
</style>
