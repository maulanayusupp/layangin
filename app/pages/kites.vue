<script setup lang="ts">
import { kitesByRarity } from '~/data/kites'

/**
 * Kite codex.
 *
 * A reference page rather than a shop: it lists every airframe with the actual
 * physical numbers, so a player can work out *why* one kite behaves differently
 * from another instead of guessing from a star rating.
 */
const { t } = useI18n()
const player = usePlayerStore()

type Filter = 'all' | 'owned' | 'locked'
const filter = ref<Filter>('all')

const tabs = computed(() => [
  { value: 'all', label: t('kites.filter.all') },
  { value: 'owned', label: t('kites.filter.owned') },
  { value: 'locked', label: t('kites.filter.locked') },
])

const gridAnchor = ref<HTMLElement | null>(null)
useScrollToOnChange(filter, gridAnchor)

const kites = computed(() => {
  const all = kitesByRarity()
  if (filter.value === 'all') return all
  const owned = filter.value === 'owned'
  return all.filter(kite => player.owns('kite', kite.id) === owned)
})

usePageSeo(() => ({
  title: t('kites.meta.title'),
  description: t('kites.meta.description'),
}))
</script>

<template>
  <div>
    <header class="l-page-header bg-grain">
      <div
        class="codex__glow bg-glow-sky"
        aria-hidden="true"
      />
      <div class="l-container--wide">
        <UiSectionHeading
          :level="1"
          :eyebrow="t('kites.header.eyebrow')"
          :title="t('kites.header.title')"
          :lead="t('kites.header.lead')"
        />
      </div>
    </header>

    <section class="l-section--tight">
      <div class="l-container--wide codex">
        <ClientOnly>
          <UiTabs
            v-model="filter"
            :items="tabs"
            :label="t('kites.filter.all')"
            id-base="codex"
            class="codex__tabs"
          />
        </ClientOnly>

        <div
          :id="`codex-panel-${filter}`"
          ref="gridAnchor"
          role="tabpanel"
          :aria-labelledby="`codex-tab-${filter}`"
        >
          <UiEmptyState
            v-if="kites.length === 0"
            :title="t('shop.empty')"
          />

          <ul
            v-else
            class="l-grid l-grid--wide"
          >
            <li
              v-for="kite in kites"
              :key="kite.id"
            >
              <KiteCard
                :kite="kite"
                :palette-id="player.save.loadout.paletteId"
                :pattern-id="player.save.loadout.patternId"
                :owned="player.owns('kite', kite.id)"
                :equipped="player.save.loadout.kiteId === kite.id"
              />
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.codex {
  display: grid;
  gap: var(--sp-5);
}

.codex__glow {
  position: absolute;
  inset: 0;
}

.codex__tabs {
  justify-self: start;
  max-width: 100%;
}
</style>
