<script setup lang="ts">
import { OPPONENTS } from '~/data/opponents'
import type { Replay } from '~/services/game/replay'
import type { OpponentDefinition } from '~/services/game/types'

/**
 * Arena page.
 *
 * Two states on one route: setup, then the match. Keeping them on one route means
 * a rematch never re-runs the router and the canvas is created once.
 *
 * Rendered client-only (see `routeRules` in nuxt.config) — setup depends on the
 * persisted save, and the match needs a canvas.
 */
const { t } = useI18n()
const player = usePlayerStore()

/** Everyone in the current match, primary first. Empty means setup. */
const lineup = ref<OpponentDefinition[]>([])
const selected = computed(() => lineup.value[0] ?? null)

/** Set while watching a recording rather than playing one. */
const replay = ref<Replay | null>(null)
/** Set while practising: the same arena, but nothing is scored and hints stay on. */
const practice = ref(false)

/**
 * Bring the arena into view when a match starts. This is the only automatic scroll
 * left on the page: setup itself never moves the reader, because being carried
 * somewhere you did not ask to go was the old wizard's worst habit.
 */
const matchAnchor = ref<HTMLElement | null>(null)
useScrollToOnChange(() => selected.value?.id ?? null, matchAnchor)

/** The rung after the currently selected one, if there is one. */
const nextOpponent = computed(() => {
  const current = selected.value
  if (!current) return null
  return OPPONENTS.find(opponent => opponent.tier === current.tier + 1) ?? null
})

/** Names of the extra opponents in a free-for-all, for the match bar. */
const extraNames = computed(() =>
  lineup.value.slice(1).map(opponent => t(`opponents.${opponent.i18nKey}.name`)),
)

function fly(opponents: OpponentDefinition[]): void {
  replay.value = null
  practice.value = false
  lineup.value = opponents
}

/** Drill against the same opponent, with nothing at stake. */
function practise(opponents: OpponentDefinition[]): void {
  replay.value = null
  practice.value = true
  lineup.value = opponents
}

/** Watch a recording. Its own cast, not the one currently selected. */
function watchReplay(recording: Replay, opponents: OpponentDefinition[]): void {
  replay.value = recording
  practice.value = false
  lineup.value = opponents
}

function advance(): void {
  replay.value = null
  practice.value = false
  // Winning moves to the next rung; otherwise back to setup.
  if (nextOpponent.value) lineup.value = [nextOpponent.value]
  else lineup.value = []
}

function leaveMatch(): void {
  replay.value = null
  practice.value = false
  lineup.value = []
}

/**
 * A match in progress is unsaved work: leaving loses the round and the coins. The
 * guard only arms while a fight is actually running — and not during practice or a
 * playback, where there is nothing at stake and the warning would be a lie.
 */
const inMatch = computed(() =>
  selected.value !== null && !practice.value && replay.value === null,
)
const leave = useLeaveGuard(inMatch)

usePageSeo(() => ({
  title: t('game.meta.title'),
  description: t('game.meta.description'),
}))
</script>

<template>
  <div>
    <!-- Live match ------------------------------------------------------- -->
    <section
      v-if="selected"
      ref="matchAnchor"
      class="play l-section--tight"
    >
      <div class="l-container--wide">
        <div class="play__bar">
          <div class="play__who">
            <p class="play__eyebrow">
              {{ t('labels.tier') }} {{ selected.tier }} ·
              {{ t(`game.arena.items.${player.activeArena.i18nKey}.name`) }}
            </p>
            <h1 class="play__title">
              {{ t(`opponents.${selected.i18nKey}.name`) }}
            </h1>
            <p
              v-if="extraNames.length > 0"
              class="play__against"
            >
              {{ t('game.setup.format.alsoFlying', { names: extraNames.join(', ') }) }}
            </p>
          </div>

          <div class="play__meta">
            <UiBadge
              v-if="selected.isBoss"
              tone="boss"
            >
              {{ t('labels.boss') }}
            </UiBadge>
            <LayoutCoinBalance />
          </div>
        </div>
      </div>

      <GameArena
        :opponents="lineup"
        :replay="replay"
        :practice="practice"
        :has-next="Boolean(nextOpponent)"
        @quit="leaveMatch"
        @next="advance"
      />

      <UiModal
        :open="leave.pending.value"
        :title="t('game.leave.title')"
        size="sm"
        @close="leave.cancel()"
      >
        <p>{{ t('game.leave.body') }}</p>

        <template #footer>
          <UiButton
            variant="ghost"
            size="sm"
            @click="leave.cancel()"
          >
            {{ t('game.leave.stay') }}
          </UiButton>
          <UiButton
            variant="danger"
            size="sm"
            @click="leave.confirm()"
          >
            {{ t('game.leave.go') }}
          </UiButton>
        </template>
      </UiModal>
    </section>

    <!-- Setup ------------------------------------------------------------- -->
    <section
      v-else
      class="l-section--tight"
    >
      <div class="l-container--wide">
        <ClientOnly>
          <GameSetup
            @fly="fly"
            @practise="practise"
            @watch="watchReplay"
          />
        </ClientOnly>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.play__bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: end;
  justify-content: space-between;
  margin-block-end: var(--sp-4);
}

.play__eyebrow {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.play__title {
  font-size: fluid(24, 36);
  line-height: 1.05;
}

/// Named opponents drafted into a free-for-all, under the headline rung.
.play__against {
  margin-block-start: rem(2);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.play__meta {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
}
</style>
