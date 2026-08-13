<script setup lang="ts">
import { OPPONENTS, isOpponentUnlocked } from '~/data/opponents'
import { getKite } from '~/data/kites'
import { availableLineupSizes, lineupFor, type LineupSize } from '~/services/game/lineup'
import type { OpponentDefinition } from '~/services/game/types'
import type { WizardStep } from '~/components/game/GameWizardSteps.vue'

/**
 * Arena page.
 *
 * A three-step wizard — kite, field, opponent — then the match. All four states
 * live on one route so a rematch never re-runs the router and the canvas is
 * created once.
 *
 * Rendered client-only (see `routeRules` in nuxt.config) — every step depends on
 * the persisted save, and the match needs a canvas.
 */
const { t, locale } = useI18n()
const localePath = useLocalePath()
const player = usePlayerStore()

type Stage = 0 | 1 | 2
const stage = ref<Stage>(0)
const selected = ref<OpponentDefinition | null>(null)

/**
 * How many opponents to fly against. One is a duel; two or three is a free-for-all
 * where they fight each other as well as the player.
 */
const lineupSize = ref<LineupSize>(1)

/**
 * Bring the new step into view when the wizard advances, and the arena into view
 * when a match starts — otherwise the reader is left looking at the bottom of the
 * step they just finished.
 */
const stepAnchor = ref<HTMLElement | null>(null)
useScrollToOnChange(stage, stepAnchor)

const matchAnchor = ref<HTMLElement | null>(null)
useScrollToOnChange(() => selected.value?.id ?? null, matchAnchor)

const equippedKite = computed(() => getKite(player.save.loadout.kiteId))

const steps = computed<WizardStep[]>(() => [
  {
    key: 'kite',
    label: t('game.wizard.steps.kite'),
    value: t(`kites.items.${equippedKite.value.i18nKey}.name`),
  },
  {
    key: 'arena',
    label: t('game.wizard.steps.arena'),
    value: t(`game.arena.items.${player.activeArena.i18nKey}.name`),
  },
  {
    key: 'opponent',
    label: t('game.wizard.steps.opponent'),
    value: selected.value ? t(`opponents.${selected.value.i18nKey}.name`) : undefined,
  },
])

/** The rung after the currently selected one, if the player has unlocked it. */
const nextOpponent = computed(() => {
  if (!selected.value) return null
  return OPPONENTS.find(opponent => opponent.tier === selected.value!.tier + 1) ?? null
})

const unlockedOpponents = computed(() =>
  OPPONENTS.filter(opponent => isOpponentUnlocked(opponent, player.save.defeated)),
)

/** Formats that can actually be filled from what the player has unlocked. */
const formats = computed(() => availableLineupSizes(null, unlockedOpponents.value))

/** Everyone in the current match, primary first. */
const lineup = computed(() =>
  selected.value
    ? lineupFor(selected.value, lineupSize.value, unlockedOpponents.value)
    : [],
)

/** Names of the extra opponents a free-for-all drafts in, for the match bar. */
const extraNames = computed(() =>
  lineup.value.slice(1).map(opponent => t(`opponents.${opponent.i18nKey}.name`)),
)

function fight(opponent: OpponentDefinition): void {
  selected.value = opponent
}

function advance(): void {
  // Winning moves to the next rung; otherwise fall back to the opponent step.
  if (nextOpponent.value) selected.value = nextOpponent.value
  else {
    selected.value = null
    stage.value = 2
  }
}

function leaveMatch(): void {
  selected.value = null
  stage.value = 2
}

/**
 * A match in progress is unsaved work: leaving loses the round and the coins. The
 * guard only arms while a fight is actually running.
 */
const inMatch = computed(() => selected.value !== null)
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
              {{ t('game.wizard.format.alsoFlying', { names: extraNames.join(', ') }) }}
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

    <!-- Wizard ----------------------------------------------------------- -->
    <template v-else>
      <header class="l-page-header bg-grain">
        <div
          class="wizard__glow bg-glow-brand"
          aria-hidden="true"
        />
        <div class="l-container--wide">
          <UiSectionHeading
            :level="1"
            :eyebrow="t('nav.play')"
            :title="t('game.wizard.title')"
            :lead="t('game.wizard.lead')"
          />
        </div>
      </header>

      <section class="l-section--tight">
        <div
          ref="stepAnchor"
          class="l-container--wide wizard"
        >
          <ClientOnly>
            <GameWizardSteps
              :steps="steps"
              :current="stage"
              @go="stage = $event as Stage"
            />
          </ClientOnly>

          <!-- Step 1: airframe ------------------------------------------- -->
          <ClientOnly v-if="stage === 0">
            <div class="wizard__step">
              <UiPanel
                tone="sunken"
                class="wizard__summary"
              >
                <div class="wizard__summary-preview">
                  <KitePreview
                    :kite-id="player.save.loadout.kiteId"
                    :palette-id="player.save.loadout.paletteId"
                    :pattern-id="player.save.loadout.patternId"
                    :name="t(`kites.items.${equippedKite.i18nKey}.name`)"
                    :tails="false"
                    ratio="1"
                  />
                </div>

                <div class="wizard__summary-body">
                  <p class="wizard__label">
                    {{ t('game.briefing.loadout') }}
                  </p>
                  <h2 class="wizard__kite">
                    {{ t(`kites.items.${equippedKite.i18nKey}.name`) }}
                  </h2>

                  <dl class="wizard__stats">
                    <UiStat
                      as="row"
                      :label="t('kites.stat.lineStrength')"
                      :value="player.resolved.stats.lineStrength.toFixed(2)"
                      :tooltip="t('kites.tooltip.lineStrength')"
                    />
                    <UiStat
                      as="row"
                      :label="t('kites.stat.cutPower')"
                      :value="player.resolved.stats.cutPower.toFixed(2)"
                      :tooltip="t('kites.tooltip.cutPower')"
                    />
                    <UiStat
                      as="row"
                      :label="t('kites.stat.area')"
                      :value="formatArea(player.resolved.stats.area, locale)"
                      :tooltip="t('kites.tooltip.area')"
                    />
                  </dl>

                  <UiButton
                    size="sm"
                    variant="secondary"
                    :to="localePath('/shop')"
                  >
                    {{ t('game.briefing.changeLoadout') }}
                  </UiButton>
                </div>
              </UiPanel>

              <UiPanel
                tone="sunken"
                notch="none"
              >
                <KitePicker />
              </UiPanel>
            </div>
          </ClientOnly>

          <!-- Step 2: field ---------------------------------------------- -->
          <ClientOnly v-else-if="stage === 1">
            <div class="wizard__step">
              <UiPanel
                tone="sunken"
                notch="none"
              >
                <GameArenaPicker />
              </UiPanel>
              <UiHint hint-id="wizard-arena">
                {{ t('game.arena.hint') }}
              </UiHint>
            </div>
          </ClientOnly>

          <!-- Step 3: opponent ------------------------------------------- -->
          <ClientOnly v-else>
            <div class="wizard__step">
              <UiHint hint-id="wizard-tension">
                {{ t('howto.tactics.items.tension.body') }}
              </UiHint>

              <p
                v-if="player.save.ladderClears > 0"
                class="wizard__difficulty"
              >
                {{ t('game.briefing.difficultyNote', { count: player.save.ladderClears }) }}
              </p>

              <!--
                Match format. Only formats that can actually be filled from the
                unlocked ladder are offered — a three-way that silently falls back
                to a duel would be worse than not offering it at all.
              -->
              <UiPanel
                v-if="formats.length > 1"
                tone="sunken"
                notch="none"
              >
                <fieldset class="wizard__format">
                  <legend class="wizard__label">
                    {{ t('game.wizard.format.legend') }}
                  </legend>

                  <div
                    class="wizard__format-options"
                    role="radiogroup"
                    :aria-label="t('game.wizard.format.legend')"
                  >
                    <button
                      v-for="size in formats"
                      :key="size"
                      type="button"
                      role="radio"
                      class="wizard__format-option"
                      :class="{ 'is-active': lineupSize === size }"
                      :aria-checked="lineupSize === size"
                      @click="lineupSize = size"
                    >
                      <span class="wizard__format-name">
                        {{ t(`game.wizard.format.size.${size}`) }}
                      </span>
                      <span class="wizard__format-note">
                        {{ t(`game.wizard.format.note.${size}`) }}
                      </span>
                    </button>
                  </div>

                  <UiHint hint-id="wizard-format">
                    {{ t('game.wizard.format.hint') }}
                  </UiHint>
                </fieldset>
              </UiPanel>

              <ul class="l-grid l-grid--wide">
                <li
                  v-for="opponent in OPPONENTS"
                  :key="opponent.id"
                >
                  <GameOpponentCard
                    :opponent="opponent"
                    :locked="!isOpponentUnlocked(opponent, player.save.defeated)"
                    :defeated="player.hasDefeated(opponent.id)"
                  >
                    <template #action>
                      <UiButton
                        block
                        size="sm"
                        :disabled="!isOpponentUnlocked(opponent, player.save.defeated)"
                        @click="fight(opponent)"
                      >
                        {{ t('actions.startMatch') }}
                      </UiButton>
                    </template>
                  </GameOpponentCard>
                </li>
              </ul>
            </div>
          </ClientOnly>

          <!-- Wizard navigation ------------------------------------------ -->
          <ClientOnly>
            <div class="wizard__nav">
              <UiButton
                variant="ghost"
                :disabled="stage === 0"
                @click="stage = (stage - 1) as Stage"
              >
                {{ t('actions.back') }}
              </UiButton>

              <UiButton
                v-if="stage < 2"
                @click="stage = (stage + 1) as Stage"
              >
                {{ t('game.wizard.next') }}
              </UiButton>
              <UiButton
                v-else-if="unlockedOpponents.length > 0"
                pulse
                @click="fight(player.nextOpponent)"
              >
                {{ t('game.wizard.fight', {
                  name: t(`opponents.${player.nextOpponent.i18nKey}.name`),
                }) }}
              </UiButton>
            </div>
          </ClientOnly>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
/// Named opponents drafted into a free-for-all, under the headline rung.
.play__against {
  margin-block-start: rem(2);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

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
  font-size: var(--fs-xl);
}

.play__meta {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
}

.wizard {
  display: grid;
  gap: var(--sp-5);
}

.wizard__glow {
  position: absolute;
  inset: 0;
}

.wizard__step {
  display: grid;
  gap: var(--sp-4);
}

.wizard__summary {
  display: grid;
  gap: var(--sp-4);

  @include mq('sm') {
    grid-template-columns: rem(130) 1fr;
    align-items: center;
  }
}

.wizard__summary-preview {
  max-width: rem(160);
}

.wizard__summary-body {
  display: grid;
  gap: var(--sp-3);
  justify-items: start;
}

.wizard__label {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.wizard__kite {
  font-size: var(--fs-lg);
}

.wizard__stats {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: var(--sp-4);
  width: 100%;
  max-width: rem(420);
}

.wizard__difficulty {
  font-size: var(--fs-xs);
  color: var(--c-warn);
}

.wizard__format {
  display: grid;
  gap: var(--sp-3);
  border: 0;
}

.wizard__format-options {
  display: grid;
  gap: var(--sp-2);

  @include mq('sm') {
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
  }
}

/// A card per format rather than a select: the trade-off needs a line of text.
.wizard__format-option {
  display: grid;
  gap: rem(3);
  padding: var(--sp-3);
  text-align: start;
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-ink-800) 55%, transparent);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);

  @include focus-visible(2px);

  @include hover {
    border-color: var(--c-border);
  }

  &.is-active {
    border-color: color-mix(in srgb, var(--c-brand) 70%, transparent);
    background: color-mix(in srgb, var(--c-brand) 12%, transparent);
  }
}

.wizard__format-name {
  font-family: var(--font-display);
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-text);
}

.wizard__format-note {
  font-size: var(--fs-xs);
  color: var(--c-text-soft);
}

.wizard__nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  justify-content: space-between;
  padding-block-start: var(--sp-4);
  border-block-start: 1px solid var(--c-hairline);
}
</style>
