<script setup lang="ts">
import type { MatchHud } from '~/composables/useMatch'

/**
 * Every live reading, as text, below the arena.
 *
 * Two jobs at once:
 *
 * 1. It is the **text alternative for the canvas**. A `<canvas>` cannot expose
 *    its contents, so the numbers a sighted player reads off the HUD are also
 *    available here as real DOM text in a polite live region.
 * 2. It is the place to look when a reading matters more than reaction speed —
 *    checking exactly what tension your line parted at, for instance.
 *
 * `aria-live="polite"` with `aria-atomic="false"` so a screen reader is not
 * flooded: only changed values are announced, and never mid-sentence.
 */
defineProps<{ hud: MatchHud }>()

const { t, locale } = useI18n()
</script>

<template>
  <section
    class="readouts"
    :aria-label="t('game.hud.readouts')"
  >
    <dl
      class="readouts__grid"
      aria-live="polite"
      aria-atomic="false"
    >
      <UiStat
        as="row"
        :label="t('game.hud.yourLine')"
        :value="formatPercent(hud.playerIntegrity, locale)"
      />
      <UiStat
        as="row"
        :label="t('game.hud.rivalLine')"
        :value="formatPercent(hud.rivalIntegrity, locale)"
      />
      <UiStat
        as="row"
        :label="t('game.hud.tension')"
        :value="formatNewtons(hud.playerTension, locale)"
      />
      <UiStat
        as="row"
        :label="t('game.hud.load')"
        :value="formatPercent(hud.playerLoad, locale)"
      />
      <UiStat
        as="row"
        :label="t('game.hud.stamina')"
        :value="formatPercent(hud.playerStamina, locale)"
      />
      <UiStat
        as="row"
        :label="t('game.hud.altitude')"
        :value="formatMetres(hud.playerAltitude, locale)"
      />
      <UiStat
        as="row"
        :label="t('game.hud.lineOut')"
        :value="formatMetres(hud.lineLength, locale)"
      />
      <UiStat
        as="row"
        :label="t('wind.label')"
        :value="`${formatSpeed(hud.windSpeed, locale)} · ${t(`wind.${hud.windLabel}`)}`"
      />
      <UiStat
        as="row"
        :label="t('game.hud.clashing')"
        :value="hud.clashing ? '✓' : '—'"
      />
      <UiStat
        as="row"
        :label="t('game.hud.time')"
        :value="formatClock(hud.timeRemaining)"
      />
    </dl>
  </section>
</template>

<style scoped lang="scss">
.readouts__grid {
  display: grid;
  gap: 0 var(--sp-4);
  grid-template-columns: 1fr auto;

  @include mq('md') {
    grid-template-columns: repeat(2, 1fr auto);
    column-gap: var(--sp-6);
  }
}
</style>
