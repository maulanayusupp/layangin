<script setup lang="ts">
import { kitesByRarity } from '~/data/kites'
import { PALETTES } from '~/data/palettes'
import { PATTERNS } from '~/data/patterns'
import { TRAIL_EFFECTS } from '~/data/effects'
import { UPGRADES } from '~/data/upgrades'

/**
 * Shop.
 *
 * Four categories behind a tab bar. Every price is fixed and shown, nothing is
 * randomised, and nothing costs real money — the notes on the page say so
 * explicitly and `/compliance` repeats it as a formal statement.
 */
const { t, locale } = useI18n()
const player = usePlayerStore()

type Tab = 'kites' | 'upgrades' | 'patterns' | 'palettes' | 'effects'
const tab = ref<Tab>('kites')

const tabs = computed(() => [
  { value: 'kites', label: t('shop.tabs.kites') },
  { value: 'upgrades', label: t('shop.tabs.upgrades') },
  { value: 'patterns', label: t('shop.tabs.patterns') },
  { value: 'palettes', label: t('shop.tabs.palettes') },
  { value: 'effects', label: t('shop.tabs.effects') },
])

const kites = computed(() => kitesByRarity())

usePageSeo(() => ({
  title: t('shop.meta.title'),
  description: t('shop.meta.description'),
}))
</script>

<template>
  <div>
    <header class="l-page-header bg-grain">
      <div
        class="shop__glow bg-glow-brand"
        aria-hidden="true"
      />
      <div class="l-container--wide shop__head">
        <UiSectionHeading
          :level="1"
          :eyebrow="t('shop.header.eyebrow')"
          :title="t('shop.header.title')"
          :lead="t('shop.header.lead')"
        />

        <ClientOnly>
          <UiPanel
            tone="sunken"
            notch="none"
            class="shop__wallet"
          >
            <p class="shop__wallet-label">
              {{ t('shop.balance') }}
            </p>
            <p class="shop__wallet-value t-num">
              {{ formatCoins(player.coins, locale) }}
            </p>
            <p class="shop__wallet-meta">
              {{ t('labels.wins') }} {{ player.wins }} · {{ t('labels.streak') }}
              {{ player.save.currentStreak }}
            </p>
          </UiPanel>
        </ClientOnly>
      </div>
    </header>

    <section class="l-section--tight">
      <div class="l-container--wide shop">
        <ClientOnly>
          <UiTabs
            v-model="tab"
            :items="tabs"
            :label="t('nav.shop')"
            id-base="shop"
            class="shop__tabs"
          />
        </ClientOnly>

        <div
          :id="`shop-panel-${tab}`"
          role="tabpanel"
          :aria-labelledby="`shop-tab-${tab}`"
        >
          <!-- Airframes ------------------------------------------------- -->
          <ClientOnly v-if="tab === 'kites'">
            <ul class="l-grid l-grid--wide">
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
                >
                  <template #action>
                    <template v-if="player.owns('kite', kite.id)">
                      <UiButton
                        v-if="player.save.loadout.kiteId === kite.id"
                        size="sm"
                        variant="ghost"
                        block
                        disabled
                      >
                        {{ t('actions.equipped') }}
                      </UiButton>
                      <UiButton
                        v-else
                        size="sm"
                        variant="secondary"
                        block
                        @click="player.equipKite(kite.id)"
                      >
                        {{ t('actions.equip') }}
                      </UiButton>
                    </template>

                    <template v-else>
                      <UiButton
                        size="sm"
                        variant="gold"
                        block
                        :disabled="player.kitePurchase(kite.id).state !== 'affordable'"
                        @click="player.buyKite(kite.id)"
                      >
                        {{ t('actions.buy') }} · {{ formatCoins(kite.price, locale) }}
                      </UiButton>
                      <p class="shop__reason">
                        {{
                          t(`shop.reason.${player.kitePurchase(kite.id).reasonKey}`, {
                            shortfall: formatCoins(player.kitePurchase(kite.id).shortfall, locale),
                            wins: player.kitePurchase(kite.id).winsNeeded,
                          })
                        }}
                      </p>
                    </template>
                  </template>
                </KiteCard>
              </li>
            </ul>
          </ClientOnly>

          <!-- Upgrades -------------------------------------------------- -->
          <ClientOnly v-else-if="tab === 'upgrades'">
            <div class="shop__upgrades">
              <UiHint hint-id="shop-upgrades">
                {{ t('shop.upgradeNote') }}
              </UiHint>
              <ul class="shop__upgrade-list">
                <ShopUpgradeRow
                  v-for="upgrade in UPGRADES"
                  :key="upgrade.id"
                  :upgrade="upgrade"
                />
              </ul>
            </div>
          </ClientOnly>

          <!-- Liveries -------------------------------------------------- -->
          <ClientOnly v-else-if="tab === 'patterns'">
            <div class="shop__cosmetics">
              <UiHint hint-id="shop-patterns">
                {{ t('shop.patternNote') }}
              </UiHint>
              <ul class="l-grid">
                <li
                  v-for="pattern in PATTERNS"
                  :key="pattern.id"
                >
                  <ShopPatternCard
                    :pattern="pattern"
                    :owned="player.owns('pattern', pattern.id)"
                    :equipped="player.save.loadout.patternId === pattern.id"
                  />
                </li>
              </ul>
            </div>
          </ClientOnly>

          <!-- Colourways ------------------------------------------------ -->
          <ClientOnly v-else-if="tab === 'palettes'">
            <div class="shop__cosmetics">
              <UiHint hint-id="shop-cosmetic">
                {{ t('shop.cosmeticNote') }}
              </UiHint>
              <ul class="l-grid">
                <li
                  v-for="palette in PALETTES"
                  :key="palette.id"
                >
                  <ShopPaletteCard
                    :palette="palette"
                    :owned="player.owns('palette', palette.id)"
                    :equipped="player.save.loadout.paletteId === palette.id"
                  />
                </li>
              </ul>
            </div>
          </ClientOnly>

          <!-- Trails ---------------------------------------------------- -->
          <ClientOnly v-else>
            <div class="shop__cosmetics">
              <UiHint hint-id="shop-cosmetic-effects">
                {{ t('shop.cosmeticNote') }}
              </UiHint>
              <ul class="l-grid">
                <li
                  v-for="effect in TRAIL_EFFECTS"
                  :key="effect.id"
                >
                  <ShopEffectCard
                    :effect="effect"
                    :owned="player.owns('effect', effect.id)"
                    :equipped="player.save.loadout.effectId === effect.id"
                  />
                </li>
              </ul>
            </div>
          </ClientOnly>
        </div>

        <ShopSettings />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.shop__glow {
  position: absolute;
  inset: 0;
}

.shop__head {
  display: grid;
  gap: var(--sp-4);
  align-items: end;

  @include mq('md') {
    grid-template-columns: 1fr auto;
  }
}

.shop__wallet {
  display: grid;
  gap: rem(2);
  min-width: rem(200);
}

.shop__wallet-label {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.shop__wallet-value {
  font-size: var(--fs-2xl);
  line-height: 1;

  @include gradient-text(var(--g-gold));
}

.shop__wallet-meta {
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}

.shop {
  display: grid;
  gap: var(--sp-5);
}

.shop__tabs {
  justify-self: start;
  max-width: 100%;
}

.shop__reason {
  font-size: var(--fs-xs);
  text-align: center;
  color: var(--c-text-mute);
}

.shop__upgrades,
.shop__cosmetics {
  display: grid;
  gap: var(--sp-4);
}

.shop__upgrade-list {
  display: grid;
  gap: var(--sp-3);
}
</style>
