<script setup lang="ts">
import { OPPONENTS } from '~/data/opponents'
import { getKite } from '~/data/kites'

/**
 * Ladder preview.
 *
 * Laid out as a rung diagram rather than a card grid: the point being made is
 * that difficulty rises in a line, and bosses sit at specific points on it.
 */
const { t, locale } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <section class="ladder l-section bg-glow-brand u-relative">
    <div class="l-container">
      <UiSectionHeading
        :eyebrow="t('home.ladder.eyebrow')"
        :title="t('home.ladder.title')"
        :lead="t('home.ladder.lead')"
      />

      <ol class="ladder__list">
        <li
          v-for="opponent in OPPONENTS"
          :key="opponent.id"
          class="ladder__rung"
          :class="{ 'is-boss': opponent.isBoss }"
        >
          <span class="ladder__tier t-num">{{ opponent.tier }}</span>

          <span
            class="ladder__marker"
            aria-hidden="true"
          />

          <span class="ladder__body">
            <span class="ladder__name">
              {{ t(`opponents.${opponent.i18nKey}.name`) }}
              <UiBadge
                v-if="opponent.isBoss"
                tone="boss"
              >{{ t('home.ladder.bossBadge') }}</UiBadge>
            </span>
            <span class="ladder__detail">
              {{ t(`kites.items.${getKite(opponent.kiteId).i18nKey}.name`) }}
              · {{ formatSpeed(opponent.windSpeed, locale) }}
              · {{ formatCoins(opponent.reward, locale) }}
            </span>
          </span>
        </li>
      </ol>

      <div class="ladder__cta">
        <UiButton :to="localePath('/play')">
          {{ t('home.ladder.cta') }}
        </UiButton>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.ladder__list {
  position: relative;
  display: grid;
  gap: 0;
  margin-block-start: var(--sp-6);

  // The rung line the markers sit on.
  &::before {
    content: '';
    position: absolute;
    inset-block: rem(18);
    inset-inline-start: rem(43);
    width: 1px;
    background: linear-gradient(180deg, var(--c-hairline), var(--c-brand));
  }
}

.ladder__rung {
  display: grid;
  grid-template-columns: rem(28) rem(30) 1fr;
  gap: var(--sp-3);
  align-items: center;
  padding-block: var(--sp-3);
  border-block-end: 1px solid var(--c-hairline);

  &:last-child {
    border-block-end: 0;
  }
}

.ladder__tier {
  font-size: var(--fs-sm);
  text-align: end;
  color: var(--c-text-mute);
}

.ladder__marker {
  position: relative;
  z-index: 1;
  justify-self: center;
  width: rem(11);
  height: rem(11);
  background: var(--c-ink-500);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  outline: rem(4) solid var(--c-bg);
}

.ladder__rung.is-boss .ladder__marker {
  width: rem(15);
  height: rem(15);
  background: var(--c-danger);
}

.ladder__body {
  display: grid;
  gap: rem(2);
}

.ladder__name {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
  font-family: var(--font-display);
  font-size: var(--fs-md);
  font-weight: 700;
}

.ladder__detail {
  font-family: var(--font-mono);
  font-size: rem(10.5);
  letter-spacing: 0.05em;
  color: var(--c-text-mute);
}

.ladder__cta {
  margin-block-start: var(--sp-5);
}
</style>
