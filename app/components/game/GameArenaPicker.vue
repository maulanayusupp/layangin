<script setup lang="ts">
import { arenaHazards } from '~/data/arenas'
import type { ArenaDefinition } from '~/services/game/types'

/**
 * Arena picker.
 *
 * Each card is an honest brief: a thumbnail drawn from the arena's own sky and
 * ground colours, plus the actual hazard counts read out of the arena data. A
 * player choosing the neighbourhood should know there are cables in it *before*
 * the countdown, because a cable will end a match faster than any opponent.
 *
 * Arenas unlock by win count and cost nothing — they are not a purchase.
 */
const { t, locale } = useI18n()
const player = usePlayerStore()

interface Entry {
  arena: ArenaDefinition
  unlocked: boolean
  winsNeeded: number
}

const entries = computed<Entry[]>(() => player.arenas)

function hazards(arena: ArenaDefinition) {
  return arenaHazards(arena)
}

/** Sky stops → a CSS gradient, so the thumbnail is the real arena palette. */
function skyGradient(arena: ArenaDefinition): string {
  const stops = arena.sky.map(([offset, color]) => `${color} ${Math.round(offset * 100)}%`)
  return `linear-gradient(180deg, ${stops.join(', ')})`
}
</script>

<template>
  <section class="arenas">
    <header class="arenas__head">
      <div>
        <h2 class="arenas__title">
          {{ t('game.arena.title') }}
        </h2>
        <p class="arenas__lead">
          {{ t('game.arena.lead') }}
        </p>
      </div>
    </header>

    <ul class="arenas__grid">
      <li
        v-for="entry in entries"
        :key="entry.arena.id"
      >
        <UiPanel
          as="article"
          :interactive="entry.unlocked"
          :accent="player.activeArena.id === entry.arena.id ? 'brand' : 'none'"
          class="arena-card"
          :class="{ 'is-locked': !entry.unlocked }"
        >
          <!-- Thumbnail built from the arena's own colours: sky, ridge, ground. -->
          <div
            v-css-vars="{
              sky: skyGradient(entry.arena),
              ground: entry.arena.ground,
              ridge: entry.arena.ridges[entry.arena.ridges.length - 1] ?? entry.arena.ground,
              sun: entry.arena.sun.color,
            }"
            class="arena-card__thumb"
            aria-hidden="true"
          >
            <span class="arena-card__sun" />
            <span class="arena-card__ridge" />
            <span class="arena-card__ground" />
            <span
              v-if="hazards(entry.arena).cableCount > 0"
              class="arena-card__cables"
            />
          </div>

          <div class="arena-card__head">
            <h3 class="arena-card__name">
              {{ t(`game.arena.items.${entry.arena.i18nKey}.name`) }}
            </h3>
            <UiBadge
              v-if="!entry.unlocked"
              tone="neutral"
              marker
            >
              {{ t('labels.locked') }}
            </UiBadge>
          </div>

          <p class="arena-card__lore">
            {{ t(`game.arena.items.${entry.arena.i18nKey}.lore`) }}
          </p>

          <UiMeter
            :value="hazards(entry.arena).rating"
            :label="t('game.arena.hazard')"
            tone="danger"
            size="sm"
          />

          <ul class="arena-card__hazards">
            <li
              v-if="hazards(entry.arena).cableCount > 0"
              class="is-danger"
            >
              {{ t('game.arena.cables', { count: hazards(entry.arena).cableCount }) }}
            </li>
            <li v-if="hazards(entry.arena).solidCount > 0">
              {{ t('game.arena.structures', { count: hazards(entry.arena).solidCount }) }}
            </li>
            <li v-if="hazards(entry.arena).shadowCount > 0">
              {{ t('game.arena.shadows', { count: hazards(entry.arena).shadowCount }) }}
            </li>
            <li v-if="entry.arena.obstacles.length === 0">
              {{ t('game.arena.clear') }}
            </li>
            <li>
              {{ t('wind.label') }}:
              {{ formatPercent(entry.arena.windMultiplier - 1 + 1, locale) }}
              · {{ t('game.arena.gust') }}
              {{ formatPercent(entry.arena.gustMultiplier - 1 + 1, locale) }}
            </li>
          </ul>

          <div class="arena-card__action">
            <UiButton
              v-if="entry.unlocked"
              size="sm"
              block
              :variant="player.activeArena.id === entry.arena.id ? 'ghost' : 'secondary'"
              :disabled="player.activeArena.id === entry.arena.id"
              @click="player.selectArena(entry.arena.id)"
            >
              {{
                player.activeArena.id === entry.arena.id
                  ? t('game.arena.selected')
                  : t('game.arena.select')
              }}
            </UiButton>
            <p
              v-else
              class="arena-card__locked"
            >
              {{ t('game.arena.unlockAt', { wins: entry.winsNeeded }) }}
            </p>
          </div>
        </UiPanel>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.arenas {
  display: grid;
  gap: var(--sp-4);
}

.arenas__title {
  font-size: var(--fs-lg);
}

.arenas__lead {
  max-width: 68ch;
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.arenas__grid {
  display: grid;
  gap: var(--sp-4);
  grid-template-columns: 1fr;

  @include mq('sm') {
    grid-template-columns: repeat(auto-fill, minmax(rem(250), 1fr));
  }
}

.arena-card {
  display: grid;
  gap: var(--sp-3);
  align-content: start;

  &.is-locked {
    opacity: 0.6;
  }
}

/// Miniature of the arena: sky wash, one ridge, ground band, optional cables.
.arena-card__thumb {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: var(--r-sm);
  background: var(--sky);
}

.arena-card__sun {
  position: absolute;
  inset-block-start: 24%;
  inset-inline-end: 18%;
  width: 16%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--sun);
  opacity: 0.85;
  filter: blur(rem(1));
}

.arena-card__ridge {
  position: absolute;
  inset: auto 0 22% 0;
  height: 26%;
  background: var(--ridge);
  clip-path: polygon(0 62%, 14% 34%, 30% 58%, 46% 22%, 62% 52%, 78% 30%, 100% 56%, 100% 100%, 0 100%);
}

.arena-card__ground {
  position: absolute;
  inset: auto 0 0 0;
  height: 24%;
  background: var(--ground);
}

.arena-card__cables {
  position: absolute;
  inset: 34% 0 auto 0;
  height: 30%;
  // Two slanted hairlines standing in for the power lines.
  background:
    linear-gradient(6deg, transparent calc(50% - 1px), rgb(10 12 18 / 75%) 50%, transparent calc(50% + 1px)),
    linear-gradient(-4deg, transparent calc(70% - 1px), rgb(10 12 18 / 55%) 70%, transparent calc(70% + 1px));
}

.arena-card__head {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
  justify-content: space-between;
}

.arena-card__name {
  font-size: var(--fs-md);
}

.arena-card__lore {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.arena-card__hazards {
  display: grid;
  gap: rem(3);

  li {
    font-family: var(--font-mono);
    font-size: rem(10);
    letter-spacing: 0.04em;
    color: var(--c-text-mute);
  }

  li.is-danger {
    color: var(--c-danger);
  }
}

.arena-card__action {
  margin-block-start: auto;
}

.arena-card__locked {
  font-size: var(--fs-xs);
  text-align: center;
  color: var(--c-text-mute);
}
</style>
