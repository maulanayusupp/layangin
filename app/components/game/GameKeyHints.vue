<script setup lang="ts">
import type { ControlFlags } from '~/composables/useMatchControls'

/**
 * Keyboard legend that lights up as keys are held.
 *
 * Doubles as the tutorial: showing which key is doing what, while it happens, is
 * more effective than a modal explaining it beforehand.
 */
defineProps<{ flags: ControlFlags }>()

const { t } = useI18n()
</script>

<template>
  <div class="keys">
    <div class="keys__group">
      <span class="keys__pad">
        <kbd
          class="keys__key"
          :class="{ 'is-held': flags.haul }"
        >W</kbd>
        <span class="keys__row">
          <kbd
            class="keys__key"
            :class="{ 'is-held': flags.left }"
          >A</kbd>
          <kbd
            class="keys__key"
            :class="{ 'is-held': flags.release }"
          >S</kbd>
          <kbd
            class="keys__key"
            :class="{ 'is-held': flags.right }"
          >D</kbd>
        </span>
      </span>

      <ul class="keys__legend">
        <li :class="{ 'is-held': flags.haul }">
          <kbd>W</kbd> {{ t('game.controls.haul') }}
        </li>
        <li :class="{ 'is-held': flags.release }">
          <kbd>S</kbd> {{ t('game.controls.release') }}
        </li>
        <li :class="{ 'is-held': flags.left }">
          <kbd>A</kbd> {{ t('game.controls.left') }}
        </li>
        <li :class="{ 'is-held': flags.right }">
          <kbd>D</kbd> {{ t('game.controls.right') }}
        </li>
      </ul>
    </div>

    <div
      class="keys__group keys__group--snap"
      :class="{ 'is-held': flags.snap }"
    >
      <kbd class="keys__space">{{ t('game.controls.snap') }}</kbd>
      <p class="keys__note">
        {{ t('game.controls.snapHint') }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.keys {
  display: grid;
  gap: var(--sp-4);

  @include mq('sm') {
    grid-template-columns: auto 1fr;
    align-items: center;
  }
}

.keys__group {
  display: flex;
  gap: var(--sp-4);
  align-items: center;
}

.keys__pad {
  display: grid;
  gap: rem(4);
  justify-items: center;
}

.keys__row {
  display: flex;
  gap: rem(4);
}

.keys__key {
  display: grid;
  place-items: center;
  width: rem(30);
  height: rem(30);
  font-size: var(--fs-xs);
  transition:
    color var(--dur-instant) var(--ease-out),
    background-color var(--dur-instant) var(--ease-out),
    border-color var(--dur-instant) var(--ease-out);

  &.is-held {
    color: var(--c-text-on-brand);
    border-color: transparent;
    background: var(--g-brand);
  }
}

.keys__legend {
  display: grid;
  gap: rem(3);

  li {
    display: flex;
    gap: rem(7);
    align-items: center;
    font-size: var(--fs-xs);
    color: var(--c-text-mute);
    transition: color var(--dur-instant) var(--ease-out);
  }

  li.is-held {
    color: var(--c-brand-soft);
  }

  kbd {
    min-width: rem(20);
  }
}

.keys__group--snap {
  gap: var(--sp-3);
}

.keys__space {
  padding-inline: var(--sp-4);
  font-family: var(--font-display);
  font-size: var(--fs-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition:
    color var(--dur-instant) var(--ease-out),
    background-color var(--dur-instant) var(--ease-out);
}

.keys__group--snap.is-held .keys__space {
  color: var(--c-text-on-brand);
  border-color: transparent;
  background: var(--g-brand);
}

.keys__note {
  max-width: 40ch;
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}
</style>
