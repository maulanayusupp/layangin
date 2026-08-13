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
 */
const props = defineProps<{
  hud: MatchHud
  opponent: OpponentDefinition
}>()

const { t, locale } = useI18n()

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

          <p class="hud__lives-group hud__lives-group--end">
            <span class="visually-hidden">
              {{ t('game.hud.rivalLives') }}: {{ hud.rivalHp }} / {{ hud.maxHp }}
            </span>
            <span
              v-for="pip in hud.maxHp"
              :key="`r${pip}`"
              class="hud__pip hud__pip--rival"
              :class="{ 'is-lost': pip > hud.rivalHp }"
              aria-hidden="true"
            />
          </p>
        </div>

        <UiMeter
          :value="hud.playerIntegrity"
          :label="t('game.hud.yourLine')"
          tone="sky"
          class="hud__line"
        />
        <UiMeter
          :value="hud.rivalIntegrity"
          :label="t('game.hud.rivalLine')"
          tone="danger"
          class="hud__line"
        />
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
          warn-past-threshold
          tone="gold"
          size="sm"
        />
        <UiMeter
          :value="hud.playerStamina"
          :label="t('game.hud.stamina')"
          tone="success"
          size="sm"
        />
      </div>

      <div
        class="hud__exchange"
        :class="{ 'is-live': hud.clashing }"
      >
        <p class="hud__exchange-label">
          {{ t('game.hud.advantage') }}
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
      {{ opponent ? t(`opponents.${opponent.i18nKey}.name`) : '' }} ·
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
  padding: var(--sp-3);
  z-index: var(--z-hud);
}

.hud__row {
  display: flex;
  gap: var(--sp-3);
  align-items: start;
}

.hud__row--bottom {
  flex-wrap: wrap;
  align-items: end;
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

.hud__lines {
  display: grid;
  gap: rem(6);
  flex: 1;
  max-width: rem(340);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-ink-900) 62%, transparent);
  backdrop-filter: blur(rem(8));
}

.hud__clock {
  display: grid;
  gap: rem(1);
  justify-items: end;
  padding: var(--sp-2) var(--sp-3);
  text-align: end;
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-ink-900) 62%, transparent);
  backdrop-filter: blur(rem(8));
}

.hud__clock-label {
  font-family: var(--font-mono);
  font-size: rem(9.5);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.hud__clock-value {
  font-size: var(--fs-lg);
  line-height: 1;
  color: var(--c-text);
}

.hud__gauges {
  display: grid;
  gap: rem(6);
  flex: 1 1 rem(180);
  max-width: rem(260);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-ink-900) 62%, transparent);
  backdrop-filter: blur(rem(8));
}

.hud__exchange {
  display: grid;
  gap: rem(5);
  flex: 1 1 rem(200);
  max-width: rem(320);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-ink-900) 62%, transparent);
  backdrop-filter: blur(rem(8));
  transition: border-color var(--dur-fast) var(--ease-out);

  &.is-live {
    border-color: color-mix(in srgb, var(--c-gold) 65%, transparent);
  }
}

.hud__exchange-label {
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: rem(9.5);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--c-text-mute);
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
  padding: var(--sp-2) var(--sp-3);
  text-align: center;
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-ink-900) 62%, transparent);
  backdrop-filter: blur(rem(8));

  &.is-ready {
    border-color: color-mix(in srgb, var(--c-brand) 70%, transparent);
  }
}

.hud__snap-label {
  font-family: var(--font-mono);
  font-size: rem(9.5);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.hud__snap-state {
  font-size: var(--fs-sm);
  color: var(--c-text);
}

.hud__snap.is-ready .hud__snap-state {
  color: var(--c-brand-soft);
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
