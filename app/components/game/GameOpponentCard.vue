<script setup lang="ts">
import { getKite } from '~/data/kites'
import { describeWind } from '~/services/game/physics/wind'
import type { OpponentDefinition } from '~/services/game/types'

/**
 * Opponent card on the briefing screen.
 *
 * Shows the fight conditions up front — their airframe and the expected wind —
 * because the right counter-loadout is a decision the player should be able to
 * make before the countdown, not discover during it.
 */
const props = defineProps<{
  opponent: OpponentDefinition
  locked: boolean
  defeated: boolean
}>()

const { t, locale } = useI18n()

const kite = computed(() => getKite(props.opponent.kiteId))
const windLabel = computed(() => describeWind(props.opponent.windSpeed))
const name = computed(() => t(`opponents.${props.opponent.i18nKey}.name`))
</script>

<template>
  <UiPanel
    as="article"
    :interactive="!locked"
    :accent="opponent.isBoss ? 'danger' : 'none'"
    class="rival"
    :class="{ 'is-locked': locked }"
  >
    <div class="rival__media">
      <KitePreview
        :kite-id="opponent.kiteId"
        :palette-id="opponent.paletteId"
        :pattern-id="opponent.patternId"
        :name="t(`kites.items.${kite.i18nKey}.name`)"
        :tails="false"
        :animate="!locked"
        ratio="4/3"
      />
      <span
        v-if="locked"
        class="rival__lock"
        aria-hidden="true"
      >🔒</span>
    </div>

    <div class="rival__head">
      <div>
        <p class="rival__tier">
          {{ t('labels.tier') }} {{ opponent.tier }}
        </p>
        <h3 class="rival__name">
          {{ name }}
        </h3>
        <p class="rival__title">
          {{ t(`opponents.${opponent.i18nKey}.title`) }}
        </p>
      </div>

      <div class="rival__badges">
        <UiBadge
          v-if="opponent.isBoss"
          tone="boss"
        >
          {{ t('labels.boss') }}
        </UiBadge>
        <UiBadge
          v-if="defeated"
          tone="success"
          marker
        >
          {{ t('labels.wins') }}
        </UiBadge>
      </div>
    </div>

    <p class="rival__lore">
      {{ t(`opponents.${opponent.i18nKey}.lore`) }}
    </p>

    <dl class="rival__specs">
      <UiStat
        as="row"
        :label="t('kites.stat.size')"
        :value="t(`kites.items.${kite.i18nKey}.name`)"
      />
      <UiStat
        as="row"
        :label="t('game.briefing.windForecast')"
        :value="`${formatSpeed(opponent.windSpeed, locale)} · ${t(`wind.${windLabel}`)}`"
      />
      <UiStat
        as="row"
        :label="t('labels.coins')"
        :value="formatCoins(opponent.reward, locale)"
      />
    </dl>

    <div class="rival__action">
      <slot name="action" />
      <p
        v-if="locked"
        class="rival__locked-note"
      >
        {{ t('game.briefing.locked', { tier: opponent.tier - 1 }) }}
      </p>
    </div>
  </UiPanel>
</template>

<style scoped lang="scss">
.rival {
  display: grid;
  gap: var(--sp-3);
  align-content: start;

  &.is-locked {
    opacity: 0.62;
  }
}

.rival__media {
  position: relative;
}

.rival__lock {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: rem(28);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-ink-900) 55%, transparent);
  backdrop-filter: blur(rem(3));
}

.rival__head {
  display: flex;
  gap: var(--sp-3);
  align-items: start;
  justify-content: space-between;
}

.rival__tier {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.rival__name {
  font-size: var(--fs-lg);
  line-height: 1.1;
}

.rival__title {
  font-size: var(--fs-xs);
  color: var(--c-brand-soft);
}

.rival__badges {
  display: grid;
  gap: rem(4);
  justify-items: end;
}

.rival__lore {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.rival__specs {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: var(--sp-3);
}

.rival__action {
  display: grid;
  gap: var(--sp-2);
  margin-block-start: auto;
}

.rival__locked-note {
  font-size: var(--fs-xs);
  text-align: center;
  color: var(--c-text-mute);
}
</style>
