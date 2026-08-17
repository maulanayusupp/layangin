<script setup lang="ts">
import { buildBriefing, isOutgeared, type BriefingPoint } from '~/services/game/briefing'
import { getKite } from '~/data/kites'
import type { ArenaDefinition, KiteId, MatchLoadout, OpponentDefinition } from '~/services/game/types'

/**
 * Pre-match brief: how to beat this particular opponent with this particular kite.
 *
 * Every line is derived from stats the simulation actually uses, and compared
 * against the player's *current* loadout — see `services/game/briefing.ts`. That is
 * what makes it answer "how do I beat someone stronger than me" rather than reciting
 * general advice: buy a tougher line and the brief stops telling you to avoid a
 * grind, because the grind is now yours to win.
 *
 * The two fundamentals come first and are never omitted. Measured, a player who
 * only holds neutral wins 0 matches in 48 and one who hauls on contact and walks to
 * contest wins 29 — no other line here is worth a fraction of that, so no other
 * line gets to be at the top.
 *
 * Bosses additionally keep their hand-written brief, which carries the flavour and
 * a gear recommendation the derivation cannot produce.
 */
const props = withDefaults(
  defineProps<{
    opponent: OpponentDefinition
    player: MatchLoadout
    arena: ArenaDefinition
    /** Start expanded. Used on the result screen after a loss. */
    open?: boolean
    /** Airframes the player owns, so a bad matchup can point at a better one. */
    ownedKiteIds?: KiteId[]
  }>(),
  { open: false, ownedKiteIds: () => [] },
)

const { t } = useI18n()

const input = computed(() => ({
  player: props.player,
  opponent: props.opponent,
  windMultiplier: props.arena.windMultiplier,
  gustMultiplier: props.arena.gustMultiplier,
  ownedKiteIds: props.ownedKiteIds,
}))

const points = computed(() => buildBriefing(input.value))
const outgunned = computed(() => isOutgeared(input.value))

const groups = computed(() => {
  const of = (kind: BriefingPoint['kind']): BriefingPoint[] =>
    points.value.filter(point => point.kind === kind)

  return [
    { kind: 'core' as const, label: t('game.brief.coreLabel'), items: of('core') },
    { kind: 'risk' as const, label: t('game.brief.riskLabel'), items: of('risk') },
    { kind: 'edge' as const, label: t('game.brief.edgeLabel'), items: of('edge') },
  ].filter(group => group.items.length > 0)
})

/** The three tips a hand-written boss brief carries. */
const bossTips = [1, 2, 3] as const

/**
 * Interpolation values, with any kite id swapped for its translated name.
 *
 * The briefing service is framework-free and deals in ids; turning one into a word
 * is the view's job, and doing it here keeps the service testable without i18n.
 */
function valuesFor(point: BriefingPoint): Record<string, string | number> {
  const values = { ...(point.values ?? {}) }

  if (typeof values.kite === 'string') {
    values.kite = t(`kites.items.${getKite(values.kite as KiteId).i18nKey}.name`)
  }

  return values
}
</script>

<template>
  <UiPanel
    :accent="outgunned ? 'danger' : 'sky'"
    class="brief"
  >
    <h2 class="brief__title">
      {{ t('game.brief.title') }}
    </h2>

    <p
      class="brief__lead"
      :class="{ 'is-warning': outgunned }"
    >
      {{ outgunned ? t('game.brief.outgeared') : t('game.brief.even') }}
    </p>

    <div
      v-for="group in groups"
      :key="group.kind"
      class="brief__group"
    >
      <p
        class="brief__label"
        :class="`brief__label--${group.kind}`"
      >
        {{ group.label }}
      </p>
      <ul class="brief__list">
        <li
          v-for="point in group.items"
          :key="point.key"
          :class="`is-${group.kind}`"
        >
          {{ t(`game.brief.points.${point.key}`, valuesFor(point)) }}
        </li>
      </ul>
    </div>

    <!--
      A boss keeps its hand-written brief as well: it names the airframe, the
      upgrade levels and what to buy next, none of which the derivation produces.
      Collapsed by default so it does not bury the derived points above.
    -->
    <details
      v-if="opponent.isBoss"
      class="brief__boss"
      :open="open"
    >
      <summary class="brief__boss-summary">
        {{ t('game.tactics.title') }}
      </summary>

      <p class="brief__boss-read">
        {{ t(`game.tactics.items.${opponent.id}.read`) }}
      </p>

      <ol class="brief__boss-list">
        <li
          v-for="tip in bossTips"
          :key="tip"
        >
          {{ t(`game.tactics.items.${opponent.id}.tips.${tip}`) }}
        </li>
      </ol>

      <p class="brief__boss-gear">
        <strong>{{ t('game.tactics.gearLabel') }}:</strong>
        {{ t(`game.tactics.items.${opponent.id}.gear`) }}
      </p>
    </details>
  </UiPanel>
</template>

<style scoped lang="scss">
.brief {
  display: grid;
  gap: var(--sp-2);
}

.brief__title {
  font-size: var(--fs-lg);
}

.brief__lead {
  max-width: 68ch;
  font-size: var(--fs-sm);
  color: var(--c-text-soft);

  &.is-warning {
    color: var(--c-warn);
  }
}

.brief__group {
  display: grid;
  gap: rem(4);
  margin-block-start: var(--sp-2);
}

.brief__label {
  font-family: var(--font-mono);
  font-size: rem(9.5);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

/// The two fundamentals are the point of the panel, so they are marked as such.
.brief__label--core {
  color: var(--c-brand-soft);
}

.brief__label--risk {
  color: var(--c-danger);
}

.brief__label--edge {
  color: var(--c-success);
}

.brief__list {
  display: grid;
  gap: rem(6);
  padding-inline-start: var(--sp-4);
  list-style: none;

  li {
    position: relative;
    max-width: 68ch;
    font-size: var(--fs-sm);
    color: var(--c-text-soft);

    // A marker rather than a bullet glyph, so the tone is carried by colour and
    // shape while the text itself stays plain.
    &::before {
      position: absolute;
      inset-inline-start: calc(var(--sp-4) * -1);
      inset-block-start: rem(7);
      width: rem(6);
      height: rem(6);
      content: '';
      clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
    }

    &.is-core {
      color: var(--c-text);

      &::before {
        background: var(--c-brand);
      }
    }

    &.is-risk::before {
      background: var(--c-danger);
    }

    &.is-edge::before {
      background: var(--c-success);
    }
  }
}

.brief__boss {
  margin-block-start: var(--sp-2);
  padding: var(--sp-3);
  border: 1px solid color-mix(in srgb, var(--c-gold) 40%, transparent);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-gold) 8%, transparent);
}

.brief__boss-summary {
  font-family: var(--font-display);
  font-size: var(--fs-sm);
  font-weight: 700;
  cursor: pointer;
  color: var(--c-gold);

  @include focus-visible(2px);
}

.brief__boss-read,
.brief__boss-gear {
  margin-block-start: var(--sp-2);
  max-width: 68ch;
  font-size: var(--fs-xs);
  color: var(--c-text-soft);
}

.brief__boss-list {
  display: grid;
  gap: var(--sp-2);
  margin-block-start: var(--sp-2);
  padding-inline-start: var(--sp-5);
  list-style: decimal;

  li {
    max-width: 68ch;
    font-size: var(--fs-xs);
    color: var(--c-text);

    &::marker {
      color: var(--c-gold);
    }
  }
}
</style>
