<script setup lang="ts">
import { arenaHazards } from '~/data/arenas'
import type { ArenaDefinition } from '~/services/game/types'

/** Announced on every pick, so a caller can close a dialog around this picker. */
const emit = defineEmits<{ select: [arenaId: ArenaDefinition['id']] }>()
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

function select(arena: ArenaDefinition): void {
  player.selectArena(arena.id)
  emit('select', arena.id)
}

interface Entry {
  arena: ArenaDefinition
  unlocked: boolean
  winsNeeded: number
}

const entries = computed<Entry[]>(() => player.arenas)

function hazards(arena: ArenaDefinition) {
  return arenaHazards(arena)
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
          <GameArenaThumb :arena="entry.arena" />

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
              @click="select(entry.arena)"
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
