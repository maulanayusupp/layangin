<script setup lang="ts">
import { KITES } from '~/data/kites'
import { OPPONENTS } from '~/data/opponents'

/**
 * Landing hero.
 *
 * The decoration is not stock: wind streaks sweep across the panel and a kite
 * silhouette drifts above the copy, both pure CSS, both stopped under
 * `prefers-reduced-motion`. Counts come from the catalogs so the page cannot
 * claim a number the game does not have.
 */
const { t } = useI18n()
const localePath = useLocalePath()

const bossCount = computed(() => OPPONENTS.filter(opponent => opponent.isBoss).length)
</script>

<template>
  <section class="hero bg-grain">
    <div
      class="hero__sky"
      aria-hidden="true"
    />
    <div
      class="hero__pattern bg-kawung"
      aria-hidden="true"
    />

    <div
      class="hero__wind"
      aria-hidden="true"
    >
      <span
        v-for="i in 5"
        :key="i"
        v-css-vars="{ i }"
        class="hero__streak"
      />
    </div>

    <div class="hero__inner l-container--wide">
      <div class="hero__copy">
        <p class="hero__eyebrow">
          <span
            class="hero__marker"
            aria-hidden="true"
          />
          {{ t('home.hero.eyebrow') }}
        </p>

        <h1 class="hero__title">
          {{ t('home.hero.title') }}
          <span class="hero__title-accent">{{ t('home.hero.titleAccent') }}</span>
        </h1>

        <p class="hero__lead">
          {{ t('home.hero.lead') }}
        </p>

        <div class="hero__actions">
          <UiButton
            size="lg"
            :to="localePath('/play')"
            pulse
          >
            {{ t('home.hero.primaryCta') }}
          </UiButton>
          <UiButton
            size="lg"
            variant="ghost"
            :to="localePath('/how-to-play')"
          >
            {{ t('home.hero.secondaryCta') }}
          </UiButton>
        </div>

        <p class="hero__note">
          {{ t('home.hero.note') }}
        </p>

        <dl class="hero__stats">
          <div class="hero__stat">
            <dt>{{ t('home.hero.stat.kites') }}</dt>
            <dd class="t-num">
              {{ KITES.length }}
            </dd>
          </div>
          <div class="hero__stat">
            <dt>{{ t('home.hero.stat.opponents') }}</dt>
            <dd class="t-num">
              {{ OPPONENTS.length }}
            </dd>
          </div>
          <div class="hero__stat">
            <dt>{{ t('home.hero.stat.bosses') }}</dt>
            <dd class="t-num">
              {{ bossCount }}
            </dd>
          </div>
        </dl>
      </div>

      <div
        class="hero__art"
        aria-hidden="true"
      >
        <div class="hero__kite hero__kite--lead">
          <BrandLogo
            mark-only
            size="lg"
          />
        </div>
        <div class="hero__kite hero__kite--trail">
          <BrandLogo mark-only />
        </div>
        <div class="hero__horizon" />
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.hero {
  position: relative;
  overflow: hidden;
  padding-block: var(--sp-7) var(--sp-8);
  border-block-end: 1px solid var(--c-hairline);
}

.hero__sky {
  position: absolute;
  inset: 0;
  background: var(--g-dusk);
  // Fade the dusk gradient into the page background instead of ending abruptly.
  mask-image: linear-gradient(180deg, #000 0%, #000 62%, transparent 100%);
}

.hero__pattern {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero__wind {
  position: absolute;
  inset: 12% 0 auto;
  pointer-events: none;
}

.hero__streak {
  position: absolute;
  // Five streaks spread down the panel, each starting at a different time.
  inset-block-start: calc(var(--i) * 3.4rem);
  inset-inline-start: 0;
  width: 42%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgb(255 226 198 / 45%), transparent);
  animation: wind-sweep calc(9s + var(--i) * 1.4s) linear infinite;
  animation-delay: calc(var(--i) * -2.2s);

  @include reduced-motion {
    animation: none;
    opacity: 0.25;
  }
}

.hero__inner {
  position: relative;
  display: grid;
  gap: var(--sp-6);

  @include mq('lg') {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    align-items: center;
    gap: var(--sp-7);
  }
}

.hero__copy {
  display: grid;
  gap: var(--sp-4);
  justify-items: start;
}

.hero__eyebrow {
  @include eyebrow;
}

.hero__marker {
  width: rem(7);
  height: rem(7);
  background: currentcolor;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

.hero__title {
  font-family: var(--font-display);
  font-size: var(--fs-hero);
  font-weight: 800;
  line-height: 0.94;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.hero__title-accent {
  display: block;

  @include gradient-text;
}

.hero__lead {
  max-width: 54ch;
  font-size: var(--fs-md);
  color: var(--c-text-soft);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
}

.hero__note {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  letter-spacing: 0.04em;
  color: var(--c-text-mute);
}

.hero__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-5);
  margin-block-start: var(--sp-3);
  padding-block-start: var(--sp-4);
  border-block-start: 1px solid var(--c-hairline);
}

.hero__stat {
  display: flex;
  flex-direction: column-reverse;
  gap: rem(2);

  dt {
    font-family: var(--font-mono);
    font-size: rem(10);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-text-mute);
  }

  dd {
    font-family: var(--font-display);
    font-size: var(--fs-xl);
    line-height: 1;
    color: var(--c-text);
  }
}

.hero__art {
  position: relative;
  display: none;
  min-height: rem(320);

  @include mq('lg') {
    display: block;
  }
}

.hero__kite {
  position: absolute;
  filter: drop-shadow(0 rem(18) rem(30) rgb(0 0 0 / 55%));
  animation: kite-drift 9s var(--ease-in-out) infinite;

  @include reduced-motion {
    animation: none;
  }
}

.hero__kite--lead {
  inset-block-start: 8%;
  inset-inline-start: 26%;
  scale: 2.6;
}

.hero__kite--trail {
  inset-block-start: 54%;
  inset-inline-start: 62%;
  scale: 1.5;
  opacity: 0.55;
  animation-delay: -3.5s;
  animation-duration: 11s;
}

.hero__horizon {
  position: absolute;
  inset: auto 0 rem(-20);
  height: 1px;
  background: var(--g-hairline);
}
</style>
