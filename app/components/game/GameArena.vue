<script setup lang="ts">
import { breakingTension } from '~/services/game/physics/fighter'
import { resolveLoadout } from '~/services/game/loadout'
import type { Replay } from '~/services/game/replay'
import type { OpponentDefinition } from '~/services/game/types'

/**
 * The arena: canvas, HUD, controls, overlays and result screen.
 *
 * Owns the match lifecycle but not the simulation — that lives in `useMatch`,
 * which keeps the 120 Hz loop outside Vue's reactivity. This component's job is
 * wiring and presentation.
 */
const props = defineProps<{
  /**
   * Everyone the player is fighting, ladder order. One for a duel, two or three
   * for a free-for-all — the first is the one they picked.
   */
  opponents: OpponentDefinition[]
  /** Next rung on the ladder, if there is one. */
  hasNext: boolean
  /**
   * A recording to watch instead of a live match. The seed, field, loadout and
   * commands all come from it, so the same duel runs again rather than a new one.
   */
  replay?: Replay | null
  /** Practice: a session that cannot be lost, with the coaching left on. */
  practice?: boolean
}>()

const emit = defineEmits<{ quit: [], next: [] }>()

const { t } = useI18n()
const player = usePlayerStore()

const canvas = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)

/** The HUD's bottom row, whose height the camera reserves. */
const hud = ref<{ footer: HTMLElement | null } | null>(null)
const hudFooter = computed(() => hud.value?.footer ?? null)

const match = useMatch({ canvas, container: stage, hudFooter })

const inputEnabled = computed(() => match.running.value && !match.paused.value)
const { flags } = useMatchControls(match.controls, inputEnabled)

// Touch controls are shown on coarse pointers; the keyboard legend on fine ones.
const coarsePointer = useMediaQuery('(hover: none) and (pointer: coarse)')

const resolved = computed(() => resolveLoadout(player.save.loadout.kiteId, player.save.upgrades))
const playerBreakingTension = computed(() => breakingTension(resolved.value.stats))

/** The rung the player chose; names the briefing and the result. */
const primary = computed(() => props.opponents[0] as OpponentDefinition)

const resolvedPhase = computed(() => match.hud.value.phase)
const showResult = computed(() => resolvedPhase.value === 'resolved')

/** Verdict + cause for the between-rounds banner. */
const roundBanner = computed(() => {
  const last = match.hud.value.lastRound
  if (!last) return null

  const lostByPlayer = last.loserIsPlayer
  return {
    lostByPlayer,
    verdict: lostByPlayer ? t('game.round.lost') : t('game.round.won'),
    reason: t(`game.round.reason.${last.reason}`, { side: lostByPlayer ? 'you' : 'them' }),
  }
})

/**
 * Touch intent → control buffer. The buffer is deliberately plain (not reactive):
 * the simulation reads it 120 times a second and must not trigger re-renders.
 */
function onTouchAxis(walk: number, reel: number): void {
  match.controls.walk = walk
  match.controls.reel = reel
}

function onTouchSnap(): void {
  match.controls.snap = true
}

function begin(): void {
  match.start(props.opponents, props.replay ?? null, { practice: props.practice === true })
}

onMounted(begin)

// Switching opponents, or handing over a different recording, restarts cleanly.
watch(
  () => [
    props.opponents.map(entry => entry.id).join(','),
    props.replay?.seed ?? 0,
    props.practice === true ? 'practice' : 'match',
  ].join('|'),
  begin,
)

function rematch(): void {
  begin()
}

function next(): void {
  emit('next')
}

function quit(): void {
  match.stop()
  emit('quit')
}
</script>

<template>
  <div
    class="arena"
    :class="{ 'arena--touch': coarsePointer }"
  >
    <div
      ref="stage"
      class="arena__stage"
    >
      <!--
        The canvas is the game. It carries a text alternative, and the same live
        readings are duplicated as DOM text in GameReadouts below.
      -->
      <canvas
        ref="canvas"
        class="arena__canvas"
        role="img"
        :aria-label="t('a11y.arenaCanvas')"
      />

      <GameHud
        ref="hud"
        :hud="match.hud.value"
        :opponents="opponents"
      />

      <!-- Unmistakable: neither of these is being scored. -->
      <p
        v-if="match.isReplay.value"
        class="arena__replay-badge"
      >
        {{ t('game.replay.watching') }}
      </p>
      <p
        v-else-if="match.isPractice.value"
        class="arena__replay-badge arena__replay-badge--practice"
      >
        {{ t('game.practice.badge') }}
      </p>

      <Transition name="page">
        <div
          v-if="resolvedPhase === 'countdown'"
          class="arena__overlay"
          role="status"
        >
          <p class="arena__countdown t-num">
            {{ Math.ceil(match.hud.value.countdown) || t('game.countdown.go') }}
          </p>
          <p class="arena__countdown-note">
            {{ t('game.countdown.ready') }}
          </p>
          <UiButton
            size="sm"
            variant="ghost"
            @click="match.skipCountdown()"
          >
            {{ t('actions.skip') }}
          </UiButton>
        </div>
      </Transition>

      <!--
        Between rounds, and while the deciding kite is still falling: name what
        happened and show the lives left, so a lost round reads as a setback rather
        than an unexplained reset.

        During `falling` the overlay is deliberately transparent — the whole point
        of that phase is to watch the kite come down, so nothing may cover it.
      -->
      <Transition name="page">
        <div
          v-if="(resolvedPhase === 'roundOver' || resolvedPhase === 'falling') && roundBanner"
          class="arena__overlay"
          :class="{ 'arena__overlay--clear': resolvedPhase === 'falling' }"
          role="status"
        >
          <p
            class="arena__round-verdict"
            :class="roundBanner.lostByPlayer ? 'is-loss' : 'is-win'"
          >
            {{ roundBanner.verdict }}
          </p>
          <p class="arena__round-reason">
            {{ roundBanner.reason }}
          </p>
          <p class="arena__round-score t-num">
            {{ t('game.hud.yourLives') }} {{ match.hud.value.playerHp }}
            ·
            {{ t('game.hud.rivalLives') }}
            {{ match.hud.value.rivals.map(rival => rival.hp).join(' / ') }}
          </p>
          <p
            v-if="resolvedPhase === 'roundOver'"
            class="arena__countdown-note"
          >
            {{ t('game.round.next', { seconds: Math.ceil(match.hud.value.roundBreak) }) }}
          </p>
        </div>
      </Transition>

      <Transition name="page">
        <div
          v-if="match.paused.value && !showResult"
          class="arena__overlay"
        >
          <h2 class="arena__overlay-title">
            {{ t('game.paused.title') }}
          </h2>
          <p class="arena__overlay-body">
            {{ t('game.paused.body') }}
          </p>
          <div class="arena__overlay-actions">
            <UiButton
              size="sm"
              @click="match.resume()"
            >
              {{ t('game.paused.resume') }}
            </UiButton>
            <UiButton
              size="sm"
              variant="ghost"
              @click="quit"
            >
              {{ match.isPractice.value ? t('game.practice.leave') : t('game.paused.quit') }}
            </UiButton>
          </div>
        </div>
      </Transition>

      <button
        v-if="!match.paused.value && !showResult"
        type="button"
        class="arena__pause"
        :aria-label="t('actions.pause')"
        @click="match.pause()"
      >
        <span aria-hidden="true">❙❙</span>
      </button>
    </div>

    <GameTouchControls
      v-if="coarsePointer"
      :disabled="!inputEnabled"
      :snap-ready="match.hud.value.snapReady"
      :snap-label="t('game.controls.snap')"
      @axis="onTouchAxis"
      @snap="onTouchSnap"
    />

    <div class="arena__panels">
      <UiPanel
        v-if="!coarsePointer"
        tone="sunken"
        notch="none"
      >
        <GameKeyHints :flags="flags" />
      </UiPanel>

      <UiPanel
        tone="sunken"
        notch="none"
      >
        <GameReadouts :hud="match.hud.value" />
      </UiPanel>
    </div>

    <GameResult
      :open="showResult"
      :outcome="match.outcome.value"
      :reward="match.reward.value"
      :coins-granted="match.coinsGranted.value"
      :stats="match.stats.value"
      :opponent="primary"
      :opponents="opponents"
      :hud="match.hud.value"
      :has-next="hasNext"
      :breaking-tension="playerBreakingTension"
      :last-round="match.hud.value.lastRound"
      :replay-text="match.replayText.value"
      :is-replay="match.isReplay.value"
      :replay-mismatch="match.replayMismatch.value"
      :challenge-awards="match.challengeAwards.value"
      :loadout="player.loadout"
      :arena="player.activeArena"
      @rematch="rematch"
      @next="next"
      @quit="quit"
    />
  </div>
</template>

<style scoped lang="scss">
.arena {
  display: grid;
  gap: var(--sp-4);
}

/**
 * On a touch device the pad has to be on screen at the same time as the field.
 *
 * The stage is otherwise 78dvh tall, which pushed the controls below the fold and
 * meant scrolling mid-duel to reach them.
 *
 * Sized by subtraction rather than as a fraction of the viewport: 330px is the
 * header, the match bar and the control pad added up, so the stage takes whatever
 * is genuinely left. A `min(48dvh, 62vw)` cap was tried first and was worse than it
 * looked — on a 375×667 phone both terms fell under the 240px floor, so the stage
 * came out 240px tall in *either* orientation and left 100px of the screen unused.
 */
.arena--touch .arena__stage {
  height: max(rem(240), calc(100dvh - rem(330)));
  min-height: rem(240);
}

/**
 * The field is the game, so it spans the whole viewport.
 *
 * `100vw` plus a negative inline margin breaks it out of the page container
 * without moving it in the DOM, which keeps the HUD's absolute positioning and
 * the focus order intact. `calc(50% - 50vw)` is the container-agnostic way to do
 * that — it works whatever gutter the parent has.
 *
 * Height is driven by viewport height rather than an aspect ratio, or a very wide
 * monitor would make the arena taller than the screen.
 */
.arena__stage {
  position: relative;
  overflow: hidden;
  width: 100vw;
  margin-inline: calc(50% - 50vw);
  height: min(78dvh, 70vw);
  min-height: rem(360);
  border-block: 1px solid var(--c-border);
  background: var(--c-ink-900);

  @include mq('md') {
    height: min(74dvh, 46vw);
  }

  @include mq('lg') {
    height: min(72dvh, 40vw);
  }
}

.arena__canvas {
  width: 100%;
  height: 100%;
}

.arena__overlay {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: grid;
  gap: var(--sp-3);
  place-content: center;
  justify-items: center;
  padding: var(--sp-5);
  text-align: center;
  background: color-mix(in srgb, var(--c-ink-900) 68%, transparent);
  backdrop-filter: blur(rem(5));
}

.arena__countdown {
  font-family: var(--font-display);
  font-size: fluid(56, 96);
  line-height: 1;
  color: var(--c-brand);
}

.arena__countdown-note {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

/**
 * The falling variant sits over the arena without obscuring it: no wash, no blur,
 * and pinned to the top so the kite has the rest of the frame to fall through.
 */
.arena__overlay--clear {
  place-content: start center;
  padding-block-start: var(--sp-6);
  background: none;
  backdrop-filter: none;
}

.arena__round-verdict {
  font-family: var(--font-display);
  font-size: fluid(28, 44);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;

  &.is-win {
    color: var(--c-success);
  }

  &.is-loss {
    color: var(--c-danger);
  }
}

.arena__round-reason {
  max-width: 32ch;
  font-size: var(--fs-md);
  color: var(--c-text-soft);
}

.arena__round-score {
  font-size: var(--fs-sm);
  letter-spacing: 0.04em;
  color: var(--c-text-mute);
}

.arena__overlay-title {
  font-size: var(--fs-xl);
}

.arena__overlay-body {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.arena__overlay-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  justify-content: center;
}

/// Sits under the pause button, out of the way of the lives and the clock.
.arena__replay-badge {
  position: absolute;
  inset-block-start: var(--sp-3);
  inset-inline-start: 50%;
  z-index: calc(var(--z-hud) + 1);
  padding: rem(3) var(--sp-3);
  font-family: var(--font-mono);
  font-size: rem(9.5);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
  translate: -50% 0;
  color: var(--c-gold);
  border: 1px solid color-mix(in srgb, var(--c-gold) 45%, transparent);
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--c-ink-900) 78%, transparent);
}

/// Practice is teal rather than gold: informative, not a prize.
.arena__replay-badge--practice {
  color: var(--c-sky);
  border-color: color-mix(in srgb, var(--c-sky) 45%, transparent);
}

.arena__pause {
  position: absolute;
  inset-block-start: var(--sp-3);
  inset-inline-end: var(--sp-3);
  z-index: calc(var(--z-hud) + 1);
  display: grid;
  place-items: center;
  font-size: rem(11);
  color: var(--c-text-soft);
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--c-ink-900) 70%, transparent);

  @include tap-target(40px);
  @include focus-visible(2px);

  @include hover {
    color: var(--c-text);
  }
}

.arena__panels {
  display: grid;
  gap: var(--sp-3);

  @include mq('lg') {
    grid-template-columns: auto 1fr;
    align-items: start;
  }
}
</style>
