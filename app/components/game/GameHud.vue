<script setup lang="ts">
import type { MatchHud } from '~/composables/useMatch'
import type { OpponentDefinition } from '~/services/game/types'
import { LINE_BREAK_TENSION } from '~/services/game/constants'

/**
 * Heads-up display overlaid on the arena.
 *
 * Deliberately sparse: during a duel the player is watching the crossing point,
 * not reading numbers. Only the four things that change a decision are shown —
 * both line conditions, your load, and your stamina — plus the exchange bar,
 * which is the single most useful read in the game.
 *
 * The full set of readings lives in `GameReadouts`, below the arena, where it is
 * also the text alternative for the canvas.
 *
 * ## On a phone it has to be two thin strips
 * On a narrow screen the desktop layout covered roughly a third of the field: four
 * bordered panels, each with a label row and a percentage, over an arena already
 * capped at 48dvh. The kites fly in that space.
 *
 * So below `md` the panel chrome is dropped for a scrim, the meters lose their label
 * rows (`UiMeter`'s `compact`, which still announces them), and the bottom row folds
 * onto one line. Nothing is removed — every figure is still in `GameReadouts` under
 * the arena, and every meter still carries its ARIA label and value text. What goes
 * is the furniture, not the information.
 */
const props = defineProps<{
  hud: MatchHud
  /** Everyone the player is fighting, ladder order. One entry for a duel. */
  opponents: OpponentDefinition[]
}>()

const { t, locale } = useI18n()

/**
 * Opponent rows, paired with their live state.
 *
 * A duel shows one; a free-for-all shows up to three, each named, because "their
 * line" means nothing when there are three of them. An eliminated opponent stays
 * on the list, greyed out — knowing who is already finished is half the read.
 */
const rivals = computed(() =>
  props.hud.rivals.map((rival, index) => ({
    ...rival,
    key: props.opponents[index]?.id ?? String(index),
    name: props.opponents[index]
      ? t(`opponents.${props.opponents[index]?.i18nKey}.name`)
      : t('game.hud.rivalLine'),
  })),
)

/** With three opponents the bars have to shrink to fit the box. */
const compact = computed(() => rivals.value.length > 1)

/**
 * Below the `md` breakpoint the meters drop their label rows.
 *
 * Matched in JS rather than CSS because it is a prop on `UiMeter`, not a style —
 * the label is removed from the layout while staying in the accessibility tree,
 * which a media query alone cannot express.
 */
const narrow = useMediaQuery('(max-width: 47.99rem)')
const barsOnly = computed(() => narrow.value)

/** Exposed so the arena can hand it to the camera as a reserved band. */
const footer = ref<HTMLElement | null>(null)
defineExpose({ footer })

/** Fraction of the load bar at which the line starts wearing itself out. */
const OVERLOAD_MARK = 1
const advantageLabel = computed(() => {
  if (props.hud.advantage > 0.56) return t('game.hud.advantageYou')
  if (props.hud.advantage < 0.44) return t('game.hud.advantageThem')
  return t('game.hud.advantageEven')
})
</script>

<template>
  <div class="hud">
    <div class="hud__row hud__row--top">
      <div class="hud__lines">
        <!--
          Lives first: the line bars refill every round, so the kite pips are the
          only read of who is actually winning the match.
        -->
        <div class="hud__lives">
          <p class="hud__lives-group">
            <span class="visually-hidden">
              {{ t('game.hud.yourLives') }}: {{ hud.playerHp }} / {{ hud.maxHp }}
            </span>
            <span
              v-for="pip in hud.maxHp"
              :key="`p${pip}`"
              class="hud__pip hud__pip--player"
              :class="{ 'is-lost': pip > hud.playerHp }"
              aria-hidden="true"
            />
          </p>

          <span class="hud__round t-num">{{ t('game.hud.round') }} {{ hud.round }}</span>

          <span class="hud__rival-lives">
            <p
              v-for="rival in rivals"
              :key="rival.key"
              class="hud__lives-group hud__lives-group--end"
              :class="{ 'is-out': rival.eliminated }"
            >
              <span class="visually-hidden">
                {{ rival.name }}: {{ rival.hp }} / {{ hud.maxHp }}
              </span>
              <span
                v-for="pip in hud.maxHp"
                :key="`${rival.key}-${pip}`"
                class="hud__pip hud__pip--rival"
                :class="{ 'is-lost': pip > rival.hp }"
                aria-hidden="true"
              />
            </p>
          </span>
        </div>

        <!--
          The short label is inline with the bar rather than above it, so on a phone
          it costs width instead of height. It is not decoration: with the label rows
          hidden, colour alone would be the only thing telling your line from theirs,
          which fails anyone who cannot separate teal from red.
        -->
        <div class="hud__line-row">
          <span class="hud__line-tag hud__line-tag--player">{{ t('game.hud.youShort') }}</span>
          <UiMeter
            :value="hud.playerIntegrity"
            :label="t('game.hud.yourLine')"
            :size="compact || barsOnly ? 'sm' : 'md'"
            :compact="barsOnly"
            tone="sky"
            class="hud__line"
          />
        </div>

        <div
          v-for="rival in rivals"
          :key="rival.key"
          class="hud__line-row"
          :class="{ 'is-out': rival.eliminated }"
        >
          <span class="hud__line-tag hud__line-tag--rival">{{ t('game.hud.themShort') }}</span>
          <UiMeter
            :value="rival.eliminated ? 0 : rival.integrity"
            :label="compact ? rival.name : t('game.hud.rivalLine')"
            :size="compact || barsOnly ? 'sm' : 'md'"
            :compact="barsOnly"
            tone="danger"
            class="hud__line"
          />
        </div>
      </div>

      <div class="hud__clock">
        <span class="hud__clock-label">{{ t('game.hud.time') }}</span>
        <span class="hud__clock-value t-num">{{ formatClock(hud.timeRemaining) }}</span>
      </div>
    </div>

    <!--
      The bottom row's height is measured by `useMatch` and reserved at the foot of
      the canvas, so the ground line and the fighters standing on it are never
      drawn behind these panels.
    -->
    <div
      ref="footer"
      class="hud__row hud__row--bottom"
    >
      <div class="hud__gauges">
        <UiMeter
          :value="hud.playerLoad"
          :label="t('game.hud.load')"
          :display="formatNewtons(hud.playerTension, locale)"
          :threshold="OVERLOAD_MARK"
          :compact="barsOnly"
          warn-past-threshold
          tone="gold"
          size="sm"
        />
        <UiMeter
          :value="hud.playerStamina"
          :label="t('game.hud.stamina')"
          :compact="barsOnly"
          tone="success"
          size="sm"
        />
      </div>

      <div
        class="hud__exchange"
        :class="{ 'is-live': hud.clashing }"
      >
        <p class="hud__exchange-label">
          <span class="hud__exchange-term">{{ t('game.hud.advantage') }}</span>
          <span class="hud__exchange-state">{{ advantageLabel }}</span>
        </p>
        <div
          v-css-vars="{ pos: hud.advantage }"
          class="hud__exchange-bar"
        >
          <span
            class="hud__exchange-mid"
            aria-hidden="true"
          />
          <span
            class="hud__exchange-knob"
            aria-hidden="true"
          />
        </div>
      </div>

      <div
        class="hud__snap"
        :class="{ 'is-ready': hud.snapReady }"
      >
        <span class="hud__snap-label">{{ t('game.hud.snap') }}</span>
        <span class="hud__snap-state t-num">
          {{ hud.snapReady ? t('game.hud.snapReady') : t('game.hud.snapCooling', { seconds: hud.snapCooldown.toFixed(1) }) }}
        </span>
      </div>
    </div>

    <!--
      Coaching, not a readout: the one place the interface tells you what to *do*.
      Sits above the bottom strip, holds for a beat so it cannot flicker, and stops
      appearing for good once the player has the habit — see `updateCoach`.

      Ranked below the two alarms: a line being destroyed by a cable or by your own
      overload is more urgent than technique, so those win the space.
    -->
    <p
      v-if="hud.coach && !hud.snagged && hud.playerLoad < OVERLOAD_MARK"
      class="hud__coach"
      role="status"
    >
      {{ t(`game.coach.${hud.coach}`) }}
    </p>

    <!-- Two things can be silently destroying your line. Both get a callout. -->
    <p
      v-if="hud.snagged"
      class="hud__alarm hud__alarm--snag"
      role="status"
    >
      {{ t('game.hud.snagged') }}
    </p>
    <p
      v-else-if="hud.playerLoad >= OVERLOAD_MARK"
      class="hud__alarm"
      role="status"
    >
      {{ t('game.hud.overload') }}
    </p>

    <p class="visually-hidden">
      {{ rivals.map(rival => rival.name).join(', ') }} ·
      {{ t('game.hud.tension') }} {{ formatNewtons(hud.playerTension, locale) }} /
      {{ formatNewtons(LINE_BREAK_TENSION, locale) }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.hud {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  // The HUD must never eat a click meant for the arena.
  pointer-events: none;
  padding: var(--sp-2);
  z-index: var(--z-hud);

  @include mq('md') {
    padding: var(--sp-3);
  }
}

/**
 * Shared panel treatment, applied only from `md`.
 *
 * Below that the boxes are dropped entirely — see the note at the top of this file.
 * A gradient scrim on each row keeps the text legible against a bright sky without
 * costing the vertical space four bordered panels did.
 */
@mixin hud-panel {
  @include mq('md') {
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--c-ink-900) 62%, transparent);
    backdrop-filter: blur(rem(8));
    padding: var(--sp-2) var(--sp-3);
  }
}

.hud__row {
  display: flex;
  gap: var(--sp-2);
  align-items: start;

  @include mq('md') {
    gap: var(--sp-3);
  }
}

/**
 * A scrim instead of panels on a phone: enough contrast to read white text over a
 * sunset sky, no borders and almost no padding. Pulled out past the HUD's own
 * padding so it reaches the edges of the canvas.
 */
.hud__row--top,
.hud__row--bottom {
  @include mq-below('md') {
    margin-inline: calc(var(--sp-2) * -1);
    padding: var(--sp-2);
  }
}

.hud__row--top {
  @include mq-below('md') {
    margin-block-start: calc(var(--sp-2) * -1);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--c-ink-900) 78%, transparent),
      transparent
    );
  }
}

.hud__row--bottom {
  flex-wrap: wrap;
  align-items: end;

  @include mq-below('md') {
    // One line: two gauges, the exchange bar, then the yank state.
    flex-wrap: nowrap;
    gap: var(--sp-2);
    align-items: center;
    margin-block-end: calc(var(--sp-2) * -1);
    background: linear-gradient(
      0deg,
      color-mix(in srgb, var(--c-ink-900) 82%, transparent),
      transparent
    );
  }
}

.hud__lives {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
  justify-content: space-between;
  padding-block-end: rem(2);
  border-block-end: 1px solid var(--c-hairline);
}

.hud__lives-group {
  display: flex;
  gap: rem(3);
}

.hud__lives-group--end {
  justify-content: flex-end;
}

/// One pip group per opponent, stacked so three of them still fit the box.
.hud__rival-lives {
  display: flex;
  flex-wrap: wrap;
  gap: rem(3) var(--sp-2);
  justify-content: flex-end;
}

/// Out of the match: still listed, visibly finished.
.is-out {
  opacity: 0.42;
}

/// A life is a small kite rhombus; losing one hollows it out.
.hud__pip {
  width: rem(11);
  height: rem(11);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  transition: background-color var(--dur-base) var(--ease-out);
}

.hud__pip--player {
  background: var(--c-sky);
}

.hud__pip--rival {
  background: var(--c-danger);
}

.hud__pip.is-lost {
  background: var(--c-ink-500);
}

.hud__round {
  font-family: var(--font-mono);
  font-size: rem(9.5);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--c-text-mute);
}

/**
 * Label beside bar on a phone, bar alone from `md` where `UiMeter` shows its own
 * label row above the track.
 */
.hud__line-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--sp-2);
  align-items: center;

  @include mq('md') {
    display: block;
  }
}

.hud__line-tag {
  font-family: var(--font-mono);
  font-size: rem(9);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;

  @include mq('md') {
    display: none;
  }
}

.hud__line-tag--player {
  color: var(--c-sky);
}

.hud__line-tag--rival {
  color: var(--c-danger);
}

.hud__lines {
  display: grid;
  gap: rem(4);
  flex: 1;

  @include hud-panel;

  @include mq('md') {
    gap: rem(6);
    max-width: rem(340);
  }
}

.hud__clock {
  // On a phone the label sits beside the value on one line rather than above it.
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
  text-align: end;

  @include hud-panel;

  @include mq('md') {
    display: grid;
    gap: rem(1);
    justify-items: end;
  }
}

.hud__clock-label {
  font-family: var(--font-mono);
  font-size: rem(9.5);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.hud__clock-value {
  font-size: var(--fs-md);
  line-height: 1;
  color: var(--c-text);

  @include mq('md') {
    font-size: var(--fs-lg);
  }
}

.hud__gauges {
  display: grid;
  gap: rem(4);
  flex: 1 1 rem(96);
  min-width: 0;

  @include hud-panel;

  @include mq('md') {
    gap: rem(6);
    flex: 1 1 rem(180);
    max-width: rem(260);
  }
}

.hud__exchange {
  display: grid;
  gap: rem(3);
  flex: 1 1 rem(110);
  min-width: 0;
  transition: border-color var(--dur-fast) var(--ease-out);

  @include hud-panel;

  @include mq('md') {
    gap: rem(5);
    flex: 1 1 rem(200);
    max-width: rem(320);
  }

  &.is-live {
    @include mq('md') {
      border-color: color-mix(in srgb, var(--c-gold) 65%, transparent);
    }
  }
}

.hud__exchange-label {
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: rem(9);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--c-text-mute);

  @include mq('md') {
    font-size: rem(9.5);
    letter-spacing: 0.12em;
  }
}

/// "Exchange" is furniture once the reader knows the bar; the verdict is not.
.hud__exchange-term {
  @include mq-below('md') {
    display: none;
  }
}

.hud__exchange-state {
  letter-spacing: 0.04em;
  color: var(--c-text-soft);
}

.hud__exchange-bar {
  position: relative;
  height: rem(8);
  border-radius: var(--r-pill);
  // Rival red on the left, player teal on the right: matches the ground markers.
  background: linear-gradient(90deg, var(--c-danger), var(--c-ink-500) 50%, var(--c-sky));
}

.hud__exchange-mid {
  position: absolute;
  inset-block: rem(-2);
  inset-inline-start: 50%;
  width: rem(1);
  background: var(--c-text);
  opacity: 0.4;
}

.hud__exchange-knob {
  position: absolute;
  inset-block-start: 50%;
  // `--pos` is the 0..1 advantage value.
  inset-inline-start: calc(var(--pos, 0.5) * 100%);
  width: rem(12);
  height: rem(12);
  background: var(--c-text);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  translate: -50% -50%;
  transition: inset-inline-start var(--dur-fast) linear;

  @include reduced-motion {
    transition: none;
  }
}

.hud__snap {
  display: grid;
  gap: rem(1);
  flex: 0 0 auto;
  text-align: center;

  @include hud-panel;

  &.is-ready {
    @include mq('md') {
      border-color: color-mix(in srgb, var(--c-brand) 70%, transparent);
    }
  }
}

/// The word "yank" is on the touch button already; the state is what matters here.
.hud__snap-label {
  font-family: var(--font-mono);
  font-size: rem(9.5);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--c-text-mute);

  @include mq-below('md') {
    display: none;
  }
}

.hud__snap-state {
  font-size: var(--fs-xs);
  white-space: nowrap;
  color: var(--c-text);

  @include mq('md') {
    font-size: var(--fs-sm);
  }
}

.hud__snap.is-ready .hud__snap-state {
  color: var(--c-brand-soft);
}

/**
 * Just above the bottom strip, centred, and narrow enough to read in a glance. Not
 * an alarm colour: this is advice, and dressing it as a warning would make the real
 * warnings mean less.
 */
.hud__coach {
  position: absolute;
  inset-block-end: rem(74);
  inset-inline: var(--sp-3);
  padding: rem(5) var(--sp-3);
  margin-inline: auto;
  width: fit-content;
  max-width: calc(100% - var(--sp-6));
  font-family: var(--font-display);
  font-size: var(--fs-sm);
  font-weight: 700;
  text-align: center;
  text-wrap: balance;
  color: var(--c-ink-900);
  border-radius: var(--r-pill);
  background: var(--c-brand-soft);
  box-shadow: var(--sh-2);

  @include animate(pop-in, var(--dur-base), var(--ease-spring));

  @include mq('md') {
    inset-block-end: rem(96);
  }
}

.hud__alarm {
  position: absolute;
  inset-block-start: 50%;
  inset-inline: 0;
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
  color: var(--c-danger);
  text-shadow: 0 2px 12px rgb(0 0 0 / 70%);
}

.hud__alarm--snag {
  color: #d6f0ff;
}
</style>
