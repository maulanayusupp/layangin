<script setup lang="ts">
import { KITES, getKite } from '~/data/kites'
import { PATTERNS, getPattern } from '~/data/patterns'
import type { KiteId, PatternId } from '~/services/game/types'

/**
 * Paginated kite picker.
 *
 * Every cell is one **airframe wearing one livery** — the two halves of what a
 * player thinks of as "a kite". Eight airframes across twelve patterns gives 96
 * cells, paged so a screen never has to render more than twenty canvases at once.
 *
 * A cell is selectable only when both halves are owned; otherwise it shows what
 * is missing, which turns the grid into a shopping list instead of a dead end.
 *
 * Numbered like the reference kite-fighting games, because a number is how people
 * actually refer to a kite in a grid.
 */
const props = withDefaults(
  defineProps<{
    /** Cells per page. */
    pageSize?: number
  }>(),
  { pageSize: 20 },
)

const { t, locale } = useI18n()
const player = usePlayerStore()

interface Cell {
  index: number
  kiteId: KiteId
  patternId: PatternId
  ownsKite: boolean
  ownsPattern: boolean
  available: boolean
  equipped: boolean
  label: string
}

/**
 * Airframe-major ordering: page 1 is the starter kite in every livery, so a new
 * player's owned combinations are all together instead of scattered.
 */
const cells = computed<Cell[]>(() => {
  const list: Cell[] = []
  let index = 1

  for (const kite of KITES) {
    for (const pattern of PATTERNS) {
      const ownsKite = player.owns('kite', kite.id)
      const ownsPattern = player.owns('pattern', pattern.id)

      list.push({
        index,
        kiteId: kite.id,
        patternId: pattern.id,
        ownsKite,
        ownsPattern,
        available: ownsKite && ownsPattern,
        equipped:
          player.save.loadout.kiteId === kite.id
          && player.save.loadout.patternId === pattern.id,
        label: `${t(`kites.items.${kite.i18nKey}.name`)} · ${t(`shop.patterns.${pattern.i18nKey}.name`)}`,
      })

      index += 1
    }
  }

  return list
})

const pageCount = computed(() => Math.max(1, Math.ceil(cells.value.length / props.pageSize)))
const page = ref(1)

/** Follow the equipped kite when it changes elsewhere (shop, briefing). */
watch(
  () => [player.save.loadout.kiteId, player.save.loadout.patternId] as const,
  () => {
    const equippedIndex = cells.value.findIndex(cell => cell.equipped)
    if (equippedIndex >= 0) page.value = Math.floor(equippedIndex / props.pageSize) + 1
  },
  { immediate: true },
)

const visible = computed(() => {
  const start = (page.value - 1) * props.pageSize
  return cells.value.slice(start, start + props.pageSize)
})

const ownedCount = computed(() => cells.value.filter(cell => cell.available).length)

function select(cell: Cell): void {
  if (!cell.available) return
  player.equipDesign(cell.kiteId, cell.patternId)
}

/** What a locked cell is missing, so the reason is on the cell itself. */
function lockReason(cell: Cell): string {
  if (!cell.ownsKite) {
    return t('kites.picker.needKite', { name: t(`kites.items.${getKite(cell.kiteId).i18nKey}.name`) })
  }
  return t('kites.picker.needPattern', {
    name: t(`shop.patterns.${getPattern(cell.patternId).i18nKey}.name`),
  })
}
</script>

<template>
  <section class="picker">
    <header class="picker__head">
      <div>
        <h2 class="picker__title">
          {{ t('kites.picker.title') }}
        </h2>
        <p class="picker__meta">
          {{ t('kites.picker.owned', {
            owned: formatCoins(ownedCount, locale),
            total: formatCoins(cells.length, locale),
          }) }}
        </p>
      </div>

      <!-- Page tabs, numbered 01..N like the arcade grids this mirrors. -->
      <nav
        class="picker__pages"
        :aria-label="t('kites.picker.pages')"
      >
        <button
          v-for="index in pageCount"
          :key="index"
          type="button"
          class="picker__page"
          :class="{ 'is-active': index === page }"
          :aria-current="index === page ? 'true' : undefined"
          @click="page = index"
        >
          {{ String(index).padStart(2, '0') }}
        </button>
      </nav>
    </header>

    <ul class="picker__grid">
      <li
        v-for="cell in visible"
        :key="`${cell.kiteId}-${cell.patternId}`"
      >
        <button
          type="button"
          class="picker__cell"
          :class="{ 'is-equipped': cell.equipped, 'is-locked': !cell.available }"
          :disabled="!cell.available"
          :aria-pressed="cell.equipped"
          :title="cell.available ? cell.label : `${cell.label} — ${lockReason(cell)}`"
          @click="select(cell)"
        >
          <span
            class="picker__number t-num"
            aria-hidden="true"
          >{{ cell.index }}</span>

          <KitePreview
            :kite-id="cell.kiteId"
            :pattern-id="cell.patternId"
            :palette-id="player.save.loadout.paletteId"
            :name="cell.label"
            :tails="false"
            :animate="false"
            ratio="1"
          />

          <span
            v-if="!cell.available"
            class="picker__lock"
            aria-hidden="true"
          >🔒</span>
          <span class="picker__label">{{ cell.label }}</span>
        </button>
      </li>
    </ul>

    <p class="picker__note">
      {{ t('kites.picker.note') }}
    </p>
  </section>
</template>

<style scoped lang="scss">
.picker {
  display: grid;
  gap: var(--sp-4);
}

.picker__head {
  display: grid;
  gap: var(--sp-3);
  align-items: end;

  @include mq('md') {
    grid-template-columns: 1fr auto;
  }
}

.picker__title {
  font-size: var(--fs-lg);
}

.picker__meta {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}

.picker__pages {
  display: flex;
  flex-wrap: wrap;
  gap: rem(4);
}

.picker__page {
  min-width: rem(40);
  min-height: rem(34);
  padding-inline: rem(8);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--c-text-mute);
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-sm);
  transition:
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);

  @include focus-visible(2px);

  @include hover {
    color: var(--c-text);
    border-color: var(--c-border-strong);
  }

  &.is-active {
    color: var(--c-text-on-brand);
    border-color: transparent;
    background: var(--g-brand);
  }
}

.picker__grid {
  display: grid;
  gap: var(--sp-2);
  grid-template-columns: repeat(auto-fill, minmax(rem(84), 1fr));

  @include mq('md') {
    grid-template-columns: repeat(auto-fill, minmax(rem(104), 1fr));
  }
}

.picker__cell {
  position: relative;
  display: grid;
  gap: rem(4);
  width: 100%;
  padding: rem(6);
  text-align: center;
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-md);
  background: var(--c-surface-sunken);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    translate var(--dur-fast) var(--ease-out);

  @include focus-visible(2px);

  @include hover {
    translate: 0 rem(-2);
    border-color: var(--c-border-strong);
  }

  &.is-equipped {
    border-color: var(--c-brand);
    box-shadow: var(--sh-glow-brand);
  }

  &.is-locked {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.picker__number {
  position: absolute;
  inset-block-start: rem(4);
  inset-inline-end: rem(6);
  font-size: rem(9.5);
  color: var(--c-text-mute);
}

.picker__lock {
  position: absolute;
  inset-block-start: 38%;
  inset-inline: 0;
  font-size: rem(16);
}

.picker__label {
  font-size: rem(9.5);
  line-height: 1.3;
  color: var(--c-text-soft);

  @include clamp-lines(2);
}

.picker__note {
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}
</style>
