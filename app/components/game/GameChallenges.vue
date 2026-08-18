<script setup lang="ts">
/**
 * Today's challenges.
 *
 * Short-term goals, because the ladder is the only other thing to aim at and the
 * rungs are far apart. Three at a time: enough to choose between, few enough to read
 * before pressing Fly.
 *
 * The copy has to be honest about the one thing players will assume: **nothing
 * expires.** A trio drawn from the date looks exactly like a daily quest, and daily
 * quests punish you for having a life. These do not — an undone one comes round
 * again and a done one stays done. The panel says so in as many words, because
 * otherwise the shape of it makes a promise the game does not keep.
 */
const player = usePlayerStore()
const { t, locale } = useI18n()

const challenges = computed(() => player.challenges)
const cleared = computed(() => player.challengesCleared)
</script>

<template>
  <UiPanel
    accent="gold"
    class="challenges"
  >
    <h2 class="challenges__title">
      {{ t('game.challenges.title') }}
    </h2>

    <p
      v-if="cleared"
      class="challenges__lead"
    >
      {{ t('game.challenges.allDone') }}
    </p>
    <template v-else>
      <p class="challenges__lead">
        {{ t('game.challenges.lead') }}
      </p>

      <ul class="challenges__list">
        <li
          v-for="challenge in challenges"
          :key="challenge.id"
          class="challenges__item"
        >
          <span
            class="challenges__marker"
            aria-hidden="true"
          />
          <span class="challenges__body">
            <span class="challenges__name">
              {{ t(`game.challenges.items.${challenge.i18nKey}.name`) }}
            </span>
            <span class="challenges__how">
              {{ t(`game.challenges.items.${challenge.i18nKey}.how`) }}
            </span>
          </span>
          <span class="challenges__reward t-num">
            +{{ formatCoins(challenge.reward, locale) }}
          </span>
        </li>
      </ul>

      <p class="challenges__note">
        {{ t('game.challenges.noExpiry') }}
      </p>
    </template>
  </UiPanel>
</template>

<style scoped lang="scss">
.challenges {
  display: grid;
  gap: var(--sp-2);
}

.challenges__title {
  font-size: var(--fs-lg);
}

.challenges__lead {
  max-width: 68ch;
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.challenges__list {
  display: grid;
  gap: var(--sp-2);
  margin-block-start: var(--sp-2);
  list-style: none;
}

.challenges__item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--sp-3);
  align-items: start;
  padding-block-end: var(--sp-2);
  border-block-end: 1px solid var(--c-hairline);

  &:last-child {
    padding-block-end: 0;
    border-block-end: 0;
  }
}

/// A kite rhombus, the same mark the life pips use.
.challenges__marker {
  width: rem(8);
  height: rem(8);
  margin-block-start: rem(5);
  background: var(--c-gold);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

.challenges__body {
  display: grid;
  gap: rem(2);
}

.challenges__name {
  font-family: var(--font-display);
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-text);
}

.challenges__how {
  max-width: 60ch;
  font-size: var(--fs-xs);
  color: var(--c-text-soft);
}

.challenges__reward {
  font-size: var(--fs-sm);
  white-space: nowrap;
  color: var(--c-gold);
}

/// The promise the panel's shape would otherwise break.
.challenges__note {
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}
</style>
