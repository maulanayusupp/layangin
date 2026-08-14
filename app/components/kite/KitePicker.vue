<script setup lang="ts">
import { kitesByRarity } from '~/data/kites'
import type { KiteDefinition } from '~/services/game/types'

/**
 * Paginated airframe picker.
 *
 * One cell per airframe, numbered and paged the way the arcade kite-fighting
 * grids do — a number is how people actually refer to a kite in a grid. Fifty
 * shapes across pages of twenty-five keeps each page to a manageable number of
 * canvases while still filling the screen.
 *
 * Each preview wears the player's equipped livery and colourway, so the grid
 * shows the shape decision in isolation: the livery is chosen in the shop.
 *
 * Locked cells stay visible with their price, which turns the grid into a
 * shopping list rather than a dead end.
 */
const props = withDefaults(
  defineProps<{
    /** Cells per page. */
    pageSize?: number
  }>(),
  { pageSize: 25 },
)

/**
 * Announced on every successful pick, including re-picking the one already
 * equipped. A caller showing this in a dialog needs to close on *any* choice —
 * watching the equipped id alone would leave the dialog open when the reader
 * confirms the kite they already had, which reads as a broken button.
 */
const emit = defineEmits<{ select: [kiteId: KiteDefinition['id']] }>()
const { t, locale } = useI18n()
const player = usePlayerStore()

interface Cell {
  index: number
  kite: KiteDefinition
  owned: boolean
  equipped: boolean
  name: string
}

/** Cheapest first, so the ordering matches how a player will actually buy. */
const cells = computed<Cell[]>(() =>
  kitesByRarity().map((kite, index) => ({
    index: index + 1,
    kite,
    owned: player.owns('kite', kite.id),
    equipped: player.save.loadout.kiteId === kite.id,
    name: t(`kites.items.${kite.i18nKey}.name`),
  })),
)

const pageCount = computed(() => Math.max(1, Math.ceil(cells.value.length / props.pageSize)))
const page = ref(1)

/** Follow the equipped airframe when it changes elsewhere (shop, wizard). */
watch(
  () => player.save.loadout.kiteId,
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

const ownedCount = computed(() => cells.value.filter(cell => cell.owned).length)

function select(cell: Cell): void {
  if (!cell.owned) return
  player.equipKite(cell.kite.id)
  emit('select', cell.kite.id)
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
        :key="cell.kite.id"
      >
        <button
          type="button"
          class="picker__cell"
          :class="{ 'is-equipped': cell.equipped, 'is-locked': !cell.owned }"
          :disabled="!cell.owned"
          :aria-pressed="cell.equipped"
          :title="cell.owned ? cell.name : `${cell.name} — ${formatCoins(cell.kite.price, locale)}`"
          @click="select(cell)"
        >
          <span
            class="picker__number t-num"
            aria-hidden="true"
          >{{ cell.index }}</span>

          <KitePreview
            :kite-id="cell.kite.id"
            :pattern-id="player.save.loadout.patternId"
            :palette-id="player.save.loadout.paletteId"
            :name="cell.name"
            :tails="false"
            :animate="false"
            ratio="1"
          />

          <span class="picker__label">{{ cell.name }}</span>

          <!-- Locked cells show the price, so the grid doubles as a shop list. -->
          <span
            v-if="!cell.owned"
            class="picker__price t-num"
          >{{ formatCoins(cell.kite.price, locale) }}</span>
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

/**
 * Small cells, many per row.
 *
 * The grid is a browsing surface, not a showcase: bigger tiles meant fewer kites
 * on screen and more scrolling. These sizes fit roughly four across on a phone
 * and ten on a desktop while the sail is still recognisable.
 */
.picker__grid {
  display: grid;
  gap: var(--sp-2);
  grid-template-columns: repeat(auto-fill, minmax(rem(72), 1fr));

  @include mq('md') {
    grid-template-columns: repeat(auto-fill, minmax(rem(84), 1fr));
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

.picker__price {
  font-size: rem(9);
  color: var(--c-gold);
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
