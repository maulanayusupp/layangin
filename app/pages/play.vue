<script setup lang="ts">
import { OPPONENTS, isOpponentUnlocked } from '~/data/opponents'
import { getKite } from '~/data/kites'
import type { OpponentDefinition } from '~/services/game/types'

/**
 * Arena page.
 *
 * Two states, not two routes: a briefing where the opponent and loadout are
 * chosen, and the live match. Keeping them on one route means a rematch does not
 * re-run the router, and the canvas is created once.
 *
 * Rendered client-only (see `routeRules` in nuxt.config) — the whole page depends
 * on the persisted save and a canvas, neither of which exists during prerender.
 */
const { t, locale } = useI18n()
const localePath = useLocalePath()
const player = usePlayerStore()

const selected = ref<OpponentDefinition | null>(null)

const equippedKite = computed(() => getKite(player.save.loadout.kiteId))

/** The rung after the currently selected one, if the player has unlocked it. */
const nextOpponent = computed(() => {
  if (!selected.value) return null
  const candidate = OPPONENTS.find(opponent => opponent.tier === selected.value!.tier + 1)
  return candidate ?? null
})

function pick(opponent: OpponentDefinition): void {
  selected.value = opponent
}

function advance(): void {
  if (nextOpponent.value) selected.value = nextOpponent.value
  else selected.value = null
}

usePageSeo(() => ({
  title: t('game.meta.title'),
  description: t('game.meta.description'),
}))
</script>

<template>
  <div>
    <!-- Live match ------------------------------------------------------- -->
    <section
      v-if="selected"
      class="play l-section--tight"
    >
      <div class="l-container--wide">
        <div class="play__bar">
          <div class="play__who">
            <p class="play__eyebrow">
              {{ t('labels.tier') }} {{ selected.tier }}
            </p>
            <h1 class="play__title">
              {{ t(`opponents.${selected.i18nKey}.name`) }}
            </h1>
          </div>

          <div class="play__meta">
            <UiBadge
              v-if="selected.isBoss"
              tone="boss"
            >
              {{ t('labels.boss') }}
            </UiBadge>
            <LayoutCoinBalance />
          </div>
        </div>

        <GameArena
          :opponent="selected"
          :has-next="Boolean(nextOpponent)"
          @quit="selected = null"
          @next="advance"
        />
      </div>
    </section>

    <!-- Briefing --------------------------------------------------------- -->
    <template v-else>
      <header class="l-page-header bg-grain">
        <div
          class="brief__glow bg-glow-brand"
          aria-hidden="true"
        />
        <div class="l-container--wide">
          <UiSectionHeading
            :level="1"
            :eyebrow="t('nav.play')"
            :title="t('game.briefing.title')"
            :lead="t('game.briefing.lead')"
          />
        </div>
      </header>

      <section class="l-section--tight">
        <div class="l-container--wide brief">
          <ClientOnly>
            <UiPanel
              tone="sunken"
              class="brief__loadout"
            >
              <div class="brief__loadout-preview">
                <KitePreview
                  :kite-id="player.save.loadout.kiteId"
                  :palette-id="player.save.loadout.paletteId"
                  :pattern-id="player.save.loadout.patternId"
                  :name="t(`kites.items.${equippedKite.i18nKey}.name`)"
                  :tails="false"
                  ratio="1"
                />
              </div>

              <div class="brief__loadout-body">
                <p class="brief__label">
                  {{ t('game.briefing.loadout') }}
                </p>
                <h2 class="brief__kite">
                  {{ t(`kites.items.${equippedKite.i18nKey}.name`) }}
                </h2>

                <dl class="brief__stats">
                  <UiStat
                    as="row"
                    :label="t('kites.stat.lineStrength')"
                    :value="player.resolved.stats.lineStrength.toFixed(2)"
                    :tooltip="t('kites.tooltip.lineStrength')"
                  />
                  <UiStat
                    as="row"
                    :label="t('kites.stat.cutPower')"
                    :value="player.resolved.stats.cutPower.toFixed(2)"
                    :tooltip="t('kites.tooltip.cutPower')"
                  />
                  <UiStat
                    as="row"
                    :label="t('shop.upgrades.reel-speed.name')"
                    :value="formatSpeed(player.resolved.reelSpeed, locale)"
                  />
                </dl>

                <p class="brief__arena">
                  {{ t('game.arena.current') }}:
                  <strong>{{ t(`game.arena.items.${player.activeArena.i18nKey}.name`) }}</strong>
                </p>

                <div class="brief__loadout-actions">
                  <UiButton
                    size="sm"
                    variant="secondary"
                    :to="localePath('/shop')"
                  >
                    {{ t('game.briefing.changeLoadout') }}
                  </UiButton>
                  <LayoutCoinBalance />
                </div>

                <p
                  v-if="player.save.ladderClears > 0"
                  class="brief__difficulty"
                >
                  {{ t('game.briefing.difficultyNote', { count: player.save.ladderClears }) }}
                </p>
              </div>
            </UiPanel>
          </ClientOnly>

          <UiHint hint-id="briefing-basics">
            {{ t('howto.tactics.items.tension.body') }}
          </UiHint>

          <!-- Choose the kite, then the field, then the opponent. -->
          <ClientOnly>
            <UiPanel
              tone="sunken"
              notch="none"
            >
              <KitePicker />
            </UiPanel>
          </ClientOnly>

          <ClientOnly>
            <UiPanel
              tone="sunken"
              notch="none"
            >
              <GameArenaPicker />
            </UiPanel>
          </ClientOnly>

          <UiHint hint-id="briefing-arena">
            {{ t('game.arena.hint') }}
          </UiHint>

          <ClientOnly>
            <ul class="l-grid l-grid--wide brief__grid">
              <li
                v-for="opponent in OPPONENTS"
                :key="opponent.id"
              >
                <GameOpponentCard
                  :opponent="opponent"
                  :locked="!isOpponentUnlocked(opponent, player.save.defeated)"
                  :defeated="player.hasDefeated(opponent.id)"
                >
                  <template #action>
                    <UiButton
                      block
                      size="sm"
                      :disabled="!isOpponentUnlocked(opponent, player.save.defeated)"
                      @click="pick(opponent)"
                    >
                      {{ t('actions.startMatch') }}
                    </UiButton>
                  </template>
                </GameOpponentCard>
              </li>
            </ul>
          </ClientOnly>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.play__bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: end;
  justify-content: space-between;
  margin-block-end: var(--sp-4);
}

.play__eyebrow {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.play__title {
  font-size: var(--fs-xl);
}

.play__meta {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
}

.brief {
  display: grid;
  gap: var(--sp-5);
}

.brief__glow {
  position: absolute;
  inset: 0;
}

.brief__loadout {
  display: grid;
  gap: var(--sp-4);

  @include mq('sm') {
    grid-template-columns: rem(140) 1fr;
    align-items: center;
  }
}

.brief__loadout-preview {
  max-width: rem(180);
}

.brief__loadout-body {
  display: grid;
  gap: var(--sp-3);
}

.brief__label {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.brief__kite {
  font-size: var(--fs-lg);
}

.brief__stats {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: var(--sp-4);
  max-width: rem(420);
}

.brief__loadout-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: center;
}

.brief__arena {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.brief__difficulty {
  font-size: var(--fs-xs);
  color: var(--c-warn);
}
</style>
