<script setup lang="ts">
import { OPPONENTS, isOpponentUnlocked } from '~/data/opponents'
import { getKite } from '~/data/kites'
import { availableLineupSizes, lineupFor, type LineupSize } from '~/services/game/lineup'
import { arenaHazards } from '~/data/arenas'
import { describeWind } from '~/services/game/physics/wind'
import type { OpponentDefinition } from '~/services/game/types'

/**
 * Pre-match setup.
 *
 * This replaced a three-step wizard. The wizard was correct and unusable: each
 * step was a full page of grid, the Next button sat *below* the grid, and picking
 * something in the middle of it left the reader scrolled halfway down with no way
 * forward but to scroll back. Choosing three things cost six scroll journeys.
 *
 * The shape here is one screen with one button. Everything already has a sensible
 * default — the equipped kite, the active field, the next rung on the ladder — so
 * the common path is: arrive, press Fly. Changing something opens a dialog over
 * the page, and the dialog closes itself the moment a choice is made, which puts
 * the reader back exactly where they were with the button still under their thumb.
 *
 * Nothing here scrolls the page on the reader's behalf. That was the other half of
 * the old problem: being moved somewhere you did not ask to go is disorienting even
 * when the destination is right.
 */
const emit = defineEmits<{ fly: [opponents: OpponentDefinition[]] }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const player = usePlayerStore()

/** Which picker dialog is open, if any. */
type Picker = 'kite' | 'arena' | 'opponent'
/**
 * Every picker closes itself on `@select` rather than on a store change, because
 * confirming the choice you already had is still a choice — watching the store
 * would leave the dialog open in exactly that case and read as a dead button.
 */
const picker = ref<Picker | null>(null)

const equippedKite = computed(() => getKite(player.save.loadout.kiteId))

/** 0..1 hazard rating of the active field, the same figure the picker shows. */
const arenaRisk = computed(() => arenaHazards(player.activeArena).rating)

/**
 * The chosen opponent. Defaults to the next rung, and follows it while untouched,
 * so a player who never opens the picker always faces the right fight.
 */
const chosen = ref<OpponentDefinition | null>(null)
const opponent = computed(() => chosen.value ?? player.nextOpponent)

const unlocked = computed(() =>
  OPPONENTS.filter(entry => isOpponentUnlocked(entry, player.save.defeated)),
)

const formats = computed(() => availableLineupSizes(opponent.value, unlocked.value))
const lineupSize = ref<LineupSize>(1)

const lineup = computed(() => lineupFor(opponent.value, lineupSize.value, unlocked.value))
const extras = computed(() =>
  lineup.value.slice(1).map(entry => t(`opponents.${entry.i18nKey}.name`)),
)

const opponentName = computed(() => t(`opponents.${opponent.value.i18nKey}.name`))
const windLabel = computed(() => describeWind(opponent.value.windSpeed))

function chooseOpponent(entry: OpponentDefinition): void {
  chosen.value = entry
  picker.value = null

  // A format that the new opponent cannot fill would otherwise silently fall back.
  if (!formats.value.includes(lineupSize.value)) lineupSize.value = 1
}

function fly(): void {
  emit('fly', lineup.value)
}
</script>

<template>
  <div class="setup">
    <header class="setup__head">
      <p class="setup__eyebrow">
        {{ t('nav.play') }}
      </p>
      <h1 class="setup__title">
        {{ t('game.setup.title') }}
      </h1>
      <p class="setup__lead">
        {{ t('game.setup.lead') }}
      </p>
    </header>

    <!--
      Three cards, three choices, all visible at once. Each is one button: the
      whole card is the target, so it is easy to hit on a phone.
    -->
    <ul class="setup__slots">
      <li>
        <button
          type="button"
          class="slot"
          @click="picker = 'kite'"
        >
          <span class="slot__label">{{ t('game.setup.slots.kite') }}</span>
          <span class="slot__art">
            <KitePreview
              :kite-id="player.save.loadout.kiteId"
              :palette-id="player.save.loadout.paletteId"
              :pattern-id="player.save.loadout.patternId"
              :name="t(`kites.items.${equippedKite.i18nKey}.name`)"
              :tails="false"
              ratio="1"
            />
          </span>
          <span class="slot__value">{{ t(`kites.items.${equippedKite.i18nKey}.name`) }}</span>
          <span class="slot__meta">
            {{ t('kites.stat.cutPower') }} {{ player.resolved.stats.cutPower.toFixed(2) }}
          </span>
          <span class="slot__change">{{ t('game.setup.change') }}</span>
        </button>
      </li>

      <li>
        <button
          type="button"
          class="slot"
          @click="picker = 'arena'"
        >
          <span class="slot__label">{{ t('game.setup.slots.arena') }}</span>
          <span class="slot__art slot__art--flat">
            <GameArenaThumb :arena="player.activeArena" />
          </span>
          <span class="slot__value">
            {{ t(`game.arena.items.${player.activeArena.i18nKey}.name`) }}
          </span>
          <span class="slot__meta">
            {{ t('game.arena.hazard') }}: {{ formatPercent(arenaRisk, locale) }}
          </span>
          <span class="slot__change">{{ t('game.setup.change') }}</span>
        </button>
      </li>

      <li>
        <button
          type="button"
          class="slot"
          @click="picker = 'opponent'"
        >
          <span class="slot__label">{{ t('game.setup.slots.opponent') }}</span>
          <span class="slot__art slot__art--flat">
            <KitePreview
              :kite-id="opponent.kiteId"
              :palette-id="opponent.paletteId"
              :pattern-id="opponent.patternId"
              :name="opponentName"
              :tails="false"
              ratio="1"
            />
          </span>
          <span class="slot__value">
            {{ opponentName }}
            <UiBadge
              v-if="opponent.isBoss"
              tone="boss"
            >
              {{ t('labels.boss') }}
            </UiBadge>
          </span>
          <span class="slot__meta">
            {{ t('labels.tier') }} {{ opponent.tier }} ·
            {{ t(`wind.${windLabel}`) }}
          </span>
          <span class="slot__change">{{ t('game.setup.change') }}</span>
        </button>
      </li>
    </ul>

    <!--
      Format sits inline rather than behind a dialog: it is one tap, it changes
      what the Fly button says, and hiding it would make the free-for-all easy to
      miss entirely. Only formats the unlocked ladder can actually fill appear.
    -->
    <fieldset
      v-if="formats.length > 1"
      class="setup__format"
    >
      <legend class="setup__format-legend">
        {{ t('game.setup.format.legend') }}
      </legend>

      <div
        class="setup__format-options"
        role="radiogroup"
        :aria-label="t('game.setup.format.legend')"
      >
        <button
          v-for="size in formats"
          :key="size"
          type="button"
          role="radio"
          class="setup__format-option"
          :class="{ 'is-active': lineupSize === size }"
          :aria-checked="lineupSize === size"
          @click="lineupSize = size"
        >
          <span class="setup__format-name">{{ t(`game.setup.format.size.${size}`) }}</span>
          <span class="setup__format-note">{{ t(`game.setup.format.note.${size}`) }}</span>
        </button>
      </div>
    </fieldset>

    <p
      v-if="player.save.ladderClears > 0"
      class="setup__difficulty"
    >
      {{ t('game.briefing.difficultyNote', { count: player.save.ladderClears }) }}
    </p>

    <!--
      Sticky at the foot of the viewport on a phone, where the three cards stack
      taller than one screen. Never out of reach, whatever the reader has scrolled.
    -->
    <div class="setup__go">
      <UiButton
        size="lg"
        pulse
        block
        @click="fly"
      >
        {{ t('game.setup.fly', { name: opponentName }) }}
      </UiButton>
      <p
        v-if="extras.length > 0"
        class="setup__go-note"
      >
        {{ t('game.setup.format.alsoFlying', { names: extras.join(', ') }) }}
      </p>
      <UiButton
        variant="ghost"
        size="sm"
        :to="localePath('/shop')"
      >
        {{ t('game.briefing.changeLoadout') }}
      </UiButton>
    </div>

    <UiHint hint-id="setup-tension">
      {{ t('howto.tactics.items.tension.body') }}
    </UiHint>

    <!-- Pickers ------------------------------------------------------------ -->
    <UiModal
      :open="picker === 'kite'"
      :title="t('game.setup.pick.kite')"
      size="lg"
      @close="picker = null"
    >
      <KitePicker @select="picker = null" />
    </UiModal>

    <UiModal
      :open="picker === 'arena'"
      :title="t('game.setup.pick.arena')"
      size="lg"
      @close="picker = null"
    >
      <GameArenaPicker @select="picker = null" />
    </UiModal>

    <UiModal
      :open="picker === 'opponent'"
      :title="t('game.setup.pick.opponent')"
      size="lg"
      @close="picker = null"
    >
      <ul class="setup__ladder">
        <li
          v-for="entry in OPPONENTS"
          :key="entry.id"
        >
          <GameOpponentCard
            :opponent="entry"
            :locked="!isOpponentUnlocked(entry, player.save.defeated)"
            :defeated="player.hasDefeated(entry.id)"
          >
            <template #action>
              <UiButton
                block
                size="sm"
                :disabled="!isOpponentUnlocked(entry, player.save.defeated)"
                @click="chooseOpponent(entry)"
              >
                {{ entry.id === opponent.id ? t('game.setup.selected') : t('actions.select') }}
              </UiButton>
            </template>
          </GameOpponentCard>
        </li>
      </ul>
    </UiModal>
  </div>
</template>

<style scoped lang="scss">
.setup {
  display: grid;
  gap: var(--sp-5);
}

.setup__head {
  display: grid;
  gap: rem(4);
}

.setup__eyebrow {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--c-brand-soft);
}

.setup__title {
  font-size: fluid(28, 44);
  line-height: 1.05;
}

.setup__lead {
  max-width: 52ch;
  font-size: var(--fs-md);
  color: var(--c-text-soft);
}

/**
 * One column on a phone, three across from the medium breakpoint. Three abreast is
 * the whole point on desktop: every choice is visible without scrolling at all.
 */
.setup__slots {
  display: grid;
  gap: var(--sp-3);

  @include mq('md') {
    grid-template-columns: repeat(3, 1fr);
  }
}

.slot {
  display: grid;
  gap: rem(4);
  width: 100%;
  height: 100%;
  padding: var(--sp-4);
  text-align: start;
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--c-ink-800) 60%, transparent);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    translate var(--dur-fast) var(--ease-out);

  @include focus-visible(2px);

  @include hover {
    border-color: var(--c-brand);
    translate: 0 rem(-2);
  }

  @include reduced-motion {
    transition: none;

    @include hover {
      translate: none;
    }
  }
}

.slot__label {
  font-family: var(--font-mono);
  font-size: rem(9.5);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.slot__art {
  display: block;
  width: 100%;
  max-width: rem(150);
  margin-inline: auto;
  margin-block: var(--sp-2);
}

.slot__art--flat {
  max-width: rem(170);
}

.slot__value {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
  font-family: var(--font-display);
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-text);
}

.slot__meta {
  font-size: var(--fs-xs);
  color: var(--c-text-soft);
}

/// Reads as a link so the card is obviously interactive, not just a summary.
.slot__change {
  margin-block-start: rem(2);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-brand-soft);

  &::after {
    content: ' →';
  }
}

.setup__format {
  display: grid;
  gap: var(--sp-2);
  border: 0;
}

.setup__format-legend {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.setup__format-options {
  display: grid;
  gap: var(--sp-2);

  @include mq('sm') {
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
  }
}

.setup__format-option {
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

.setup__format-name {
  font-family: var(--font-display);
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-text);
}

.setup__format-note {
  font-size: var(--fs-xs);
  color: var(--c-text-soft);
}

.setup__difficulty {
  font-size: var(--fs-xs);
  color: var(--c-warn);
}

.setup__go {
  display: grid;
  gap: var(--sp-2);
  justify-items: center;
  position: sticky;
  inset-block-end: var(--sp-3);
  z-index: var(--z-sticky);
  padding: var(--sp-3);
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--c-ink-900) 88%, transparent);
  backdrop-filter: blur(rem(10));

  @include mq('md') {
    // Enough room on a desktop that nothing needs pinning.
    position: static;
    background: none;
    backdrop-filter: none;
    border: 0;
    padding: 0;
  }
}

.setup__go-note {
  font-size: var(--fs-xs);
  text-align: center;
  color: var(--c-text-soft);
}

.setup__ladder {
  display: grid;
  gap: var(--sp-3);

  @include mq('sm') {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
