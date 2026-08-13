<script setup lang="ts">
import { selectAdvice } from '~/services/game/advice'
import { LINE_BREAK_TENSION } from '~/services/game/constants'
import type { MatchHud } from '~/composables/useMatch'
import type {
  MatchOutcome,
  MatchReward,
  MatchStats,
  OpponentDefinition,
  RoundResult,
} from '~/services/game/types'

/**
 * Result screen.
 *
 * Not dismissible: the coins have already been banked by the time this appears,
 * and the player should choose the next action explicitly rather than clicking
 * the backdrop and wondering what happened.
 */
const props = defineProps<{
  open: boolean
  outcome: MatchOutcome
  reward: MatchReward | null
  coinsGranted: number
  stats: MatchStats | null
  opponent: OpponentDefinition
  hud: MatchHud
  /** True when a next rung on the ladder exists. */
  hasNext: boolean
  breakingTension?: number
  /** How the deciding round ended, so the cause can be named precisely. */
  lastRound?: RoundResult | null
}>()

const emit = defineEmits<{ rematch: [], next: [], quit: [] }>()

const { t, locale } = useI18n()

const playerWon = computed(
  () =>
    props.outcome.kind !== 'pending'
    && 'winner' in props.outcome
    && props.outcome.winner === 'player',
)

const isDraw = computed(
  () => props.outcome.kind === 'timeout' && props.outcome.winner === 'draw',
)

const title = computed(() => {
  if (isDraw.value) return t('game.result.draw')
  return playerWon.value ? t('game.result.win') : t('game.result.loss')
})

/**
 * One line naming exactly how the match ended.
 *
 * When the final life went to something other than the opponent — a cable, the
 * kite's own overloaded line — the round reason is used instead of the generic
 * "your line parted". Reporting a cable cut as a duel loss is what made a defeat
 * read as inexplicable.
 */
const reason = computed(() => {
  const { outcome, lastRound } = props

  if (outcome.kind === 'cut' && lastRound?.reason === 'cable') {
    return lastRound.loser === 'player'
      ? t('game.result.byCable')
      : t('game.result.byCableAgainst')
  }

  switch (outcome.kind) {
    case 'cut':
      return outcome.winner === 'player' ? t('game.result.byCut') : t('game.result.byCutAgainst')
    case 'crash':
      return outcome.winner === 'player'
        ? t('game.result.byCrash')
        : t('game.result.byCrashAgainst')
    case 'obstacle':
      return outcome.winner === 'player'
        ? t('game.result.byObstacle')
        : t('game.result.byObstacleAgainst')
    case 'timeout':
      if (outcome.winner === 'draw') return t('game.result.byTimeoutDraw')
      return outcome.winner === 'player'
        ? t('game.result.byTimeout')
        : t('game.result.byTimeoutAgainst')
    default:
      return ''
  }
})

const advice = computed(() => {
  if (!props.stats) return null
  return selectAdvice({
    outcome: props.outcome,
    lastReason: props.lastRound?.reason,
    stats: props.stats,
    playerIntegrity: props.hud.playerIntegrity,
    rivalIntegrity: props.hud.rivalIntegrity,
    breakingTension: props.breakingTension ?? LINE_BREAK_TENSION,
  })
})
</script>

<template>
  <UiModal
    :open="open"
    :title="title"
    :dismissible="false"
    size="md"
  >
    <div class="result">
      <p
        class="result__reason"
        :class="playerWon ? 'is-win' : 'is-loss'"
      >
        {{ reason }}
      </p>

      <div class="result__coins">
        <div class="result__coin-row">
          <span>{{ t('game.result.coins') }}</span>
          <span class="t-num">{{ formatCoins(reward?.coins ?? 0, locale) }}</span>
        </div>
        <div
          v-if="(reward?.bonusCoins ?? 0) > 0"
          class="result__coin-row"
        >
          <span>
            {{ t('game.result.bonus') }}
            <template v-if="reward?.isFirstWin">· {{ t('game.result.firstWin') }}</template>
          </span>
          <span class="t-num">+{{ formatCoins(reward?.bonusCoins ?? 0, locale) }}</span>
        </div>
        <div class="result__coin-row result__coin-row--total">
          <span>{{ t('game.result.total') }}</span>
          <span class="t-num">{{ formatCoins(coinsGranted, locale) }}</span>
        </div>
      </div>

      <section
        v-if="stats"
        class="result__stats"
      >
        <h3 class="result__stats-title">
          {{ t('game.result.stats.title') }}
        </h3>
        <dl class="result__stats-grid">
          <UiStat
            as="row"
            :label="t('game.result.stats.duration')"
            :value="formatClock(stats.durationSeconds)"
          />
          <UiStat
            as="row"
            :label="t('game.result.stats.clashTime')"
            :value="`${stats.clashSeconds.toFixed(1)}s`"
          />
          <UiStat
            as="row"
            :label="t('game.result.stats.peakTension')"
            :value="formatNewtons(stats.peakTension, locale)"
          />
          <UiStat
            as="row"
            :label="t('game.result.stats.peakAltitude')"
            :value="formatMetres(stats.peakAltitude, locale)"
          />
          <UiStat
            as="row"
            :label="t('game.result.stats.rounds')"
            :value="`${stats.roundsWon} / ${stats.roundsLost}`"
          />
          <UiStat
            as="row"
            :label="t('game.result.stats.snaps')"
            :value="String(stats.snapsUsed)"
          />
        </dl>
      </section>

      <UiHint
        v-if="advice"
        :hint-id="`advice-${advice}`"
        persistent
      >
        {{ t(`game.result.advice.${advice}`) }}
      </UiHint>
    </div>

    <template #footer>
      <UiButton
        variant="ghost"
        size="sm"
        @click="emit('quit')"
      >
        {{ t('actions.back') }}
      </UiButton>
      <UiButton
        variant="secondary"
        size="sm"
        @click="emit('rematch')"
      >
        {{ t('actions.rematch') }}
      </UiButton>
      <UiButton
        v-if="playerWon && hasNext"
        size="sm"
        @click="emit('next')"
      >
        {{ t('actions.nextOpponent') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<style scoped lang="scss">
.result {
  display: grid;
  gap: var(--sp-4);
}

.result__reason {
  font-family: var(--font-display);
  font-size: var(--fs-md);
  font-weight: 700;

  &.is-win {
    color: var(--c-success);
  }

  &.is-loss {
    color: var(--c-danger);
  }
}

.result__coins {
  display: grid;
  gap: rem(6);
  padding: var(--sp-4);
  border: 1px solid color-mix(in srgb, var(--c-gold) 26%, transparent);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-gold) 7%, transparent);
}

.result__coin-row {
  display: flex;
  gap: var(--sp-3);
  align-items: baseline;
  justify-content: space-between;
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.result__coin-row--total {
  padding-block-start: rem(7);
  font-size: var(--fs-md);
  color: var(--c-gold);
  border-block-start: 1px solid color-mix(in srgb, var(--c-gold) 26%, transparent);
}

.result__stats-title {
  margin-block-end: rem(4);
  font-size: var(--fs-sm);
  color: var(--c-text-mute);
}

.result__stats-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: var(--sp-4);
}
</style>
