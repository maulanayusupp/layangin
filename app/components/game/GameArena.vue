<script setup lang="ts">
import { breakingTension } from '~/services/game/physics/fighter'
import { resolveLoadout } from '~/services/game/loadout'
import type { OpponentDefinition } from '~/services/game/types'

/**
 * The arena: canvas, HUD, controls, overlays and result screen.
 *
 * Owns the match lifecycle but not the simulation — that lives in `useMatch`,
 * which keeps the 120 Hz loop outside Vue's reactivity. This component's job is
 * wiring and presentation.
 */
const props = defineProps<{
  opponent: OpponentDefinition
  /** Next rung on the ladder, if there is one. */
  hasNext: boolean
}>()

const emit = defineEmits<{ quit: [], next: [] }>()

const { t } = useI18n()
const player = usePlayerStore()

const canvas = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)

const match = useMatch({ canvas, container: stage })

const inputEnabled = computed(() => match.running.value && !match.paused.value)
const { flags } = useMatchControls(match.controls, inputEnabled)

// Touch controls are shown on coarse pointers; the keyboard legend on fine ones.
const coarsePointer = useMediaQuery('(hover: none) and (pointer: coarse)')

const resolved = computed(() => resolveLoadout(player.save.loadout.kiteId, player.save.upgrades))
const playerBreakingTension = computed(() => breakingTension(resolved.value.stats))

const resolvedPhase = computed(() => match.hud.value.phase)
const showResult = computed(() => resolvedPhase.value === 'resolved')

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
  match.start(props.opponent)
}

onMounted(begin)

// Switching opponents from the briefing restarts the match cleanly.
watch(() => props.opponent.id, begin)

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
  <div class="arena">
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
        :hud="match.hud.value"
        :opponent="opponent"
      />

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
              {{ t('game.paused.quit') }}
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
      :opponent="opponent"
      :hud="match.hud.value"
      :has-next="hasNext"
      :breaking-tension="playerBreakingTension"
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

.arena__stage {
  position: relative;
  overflow: hidden;
  // Tall enough to read the wind window on a phone, capped so a desktop match
  // still fits above the fold with the readouts.
  aspect-ratio: 4 / 5;
  max-height: 68dvh;
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  background: var(--c-ink-900);

  @include mq('sm') {
    aspect-ratio: 16 / 10;
  }

  @include mq('lg') {
    aspect-ratio: 16 / 9;
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
