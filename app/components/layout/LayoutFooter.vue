<script setup lang="ts">
import { SITE } from '~~/shared/constants/site'

/**
 * Site footer. Also the home of the compliance and legal links, which are
 * required to be reachable from every page.
 */
const { t } = useI18n()
const localePath = useLocalePath()

const columns = computed(() => [
  {
    title: t('footer.sections.game'),
    links: [
      { to: localePath('/play'), label: t('nav.play') },
      { to: localePath('/kites'), label: t('nav.kites') },
      { to: localePath('/shop'), label: t('nav.shop') },
    ],
  },
  {
    title: t('footer.sections.learn'),
    links: [
      { to: localePath('/how-to-play'), label: t('nav.howToPlay') },
      { to: localePath('/about'), label: t('nav.about') },
      { to: localePath('/contact'), label: t('nav.contact') },
    ],
  },
  {
    title: t('footer.sections.site'),
    links: [
      { to: localePath('/compliance'), label: t('nav.compliance') },
      { to: localePath('/legal/privacy'), label: t('nav.privacy') },
      { to: localePath('/legal/terms'), label: t('nav.terms') },
      { to: localePath('/legal/cookies'), label: t('nav.cookies') },
    ],
  },
])

const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer bg-grain">
    <div
      class="footer__pattern bg-kawung"
      aria-hidden="true"
    />

    <div class="footer__inner l-container--wide">
      <div class="footer__brand">
        <BrandLogo />
        <p class="footer__tagline">
          {{ t('brand.shortDescription') }}
        </p>
        <p class="footer__note">
          {{ t('footer.rights') }}
        </p>
        <p class="footer__note">
          {{ t('footer.noAffiliation') }}
        </p>
      </div>

      <nav
        v-for="column in columns"
        :key="column.title"
        class="footer__column"
        :aria-label="column.title"
      >
        <h2 class="footer__title">
          {{ column.title }}
        </h2>
        <ul class="footer__list">
          <li
            v-for="link in column.links"
            :key="link.to"
          >
            <NuxtLink
              class="footer__link"
              :to="link.to"
            >{{ link.label }}</NuxtLink>
          </li>
        </ul>
      </nav>
    </div>

    <div class="footer__base l-container--wide">
      <p class="footer__meta">
        © {{ year }} · {{ t('footer.builtBy', { name: SITE.contactName }) }}
      </p>
      <a
        class="footer__link"
        :href="SITE.repository"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('footer.sourceCode') }}
        <span class="visually-hidden"> ({{ t('a11y.external') }})</span>
      </a>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.footer {
  position: relative;
  overflow: hidden;
  margin-block-start: var(--sp-8);
  border-block-start: 1px solid var(--c-hairline);
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--c-ink-800) 70%, transparent));
}

.footer__pattern {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.footer__inner {
  position: relative;
  display: grid;
  gap: var(--sp-6);
  padding-block: var(--sp-7) var(--sp-6);

  @include mq('sm') {
    grid-template-columns: repeat(3, 1fr);
  }

  @include mq('lg') {
    grid-template-columns: 2fr repeat(3, 1fr);
    gap: var(--sp-7);
  }
}

.footer__brand {
  display: grid;
  gap: var(--sp-3);
  align-content: start;

  @include mq('sm') {
    grid-column: 1 / -1;
  }

  @include mq('lg') {
    grid-column: auto;
  }
}

.footer__tagline {
  max-width: 42ch;
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.footer__note {
  max-width: 46ch;
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}

.footer__column {
  display: grid;
  gap: var(--sp-3);
  align-content: start;
}

.footer__title {
  font-family: var(--font-mono);
  font-size: rem(10.5);
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.footer__list {
  display: grid;
  gap: rem(2);
}

.footer__link {
  display: inline-flex;
  align-items: center;
  min-height: rem(32);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
  border-radius: var(--r-xs);
  transition: color var(--dur-fast) var(--ease-out);

  @include focus-visible(3px);

  @include hover {
    color: var(--c-brand-soft);
  }
}

.footer__base {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: center;
  justify-content: space-between;
  padding-block: var(--sp-4);
  border-block-start: 1px solid var(--c-hairline);
}

.footer__meta {
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}
</style>
