<script setup lang="ts">
import { SITE } from '~~/shared/constants/site'
import { COMPLIANCE_REVIEWED } from '~~/shared/constants/legal'

/**
 * Compliance page.
 *
 * Kept in sync with the code by hand, on purpose: every claim here corresponds to
 * something specific in the repository (the storage keys in
 * `services/persistence/schema.ts`, the cosmetic-only effects in `data/effects.ts`,
 * the AI limits in `input/ai.ts`, the a11y rules in `base/_a11y.scss`). The change
 * workflow in CLAUDE.md requires updating this page whenever any of those move.
 *
 * The accessibility section deliberately separates what is implemented from known
 * gaps rather than claiming conformance that has not been audited.
 */
const { t, tm, rt } = useI18n()
const localePath = useLocalePath()

const list = (key: string) => computed(() => (tm(key) as unknown[]).map(item => rt(item as string)))

const accessibilityDone = list('compliance.accessibility.done')
const accessibilityGaps = list('compliance.accessibility.gaps')

const contentItems = ['cultural', 'safety', 'assets'] as const

/**
 * The three definition-list sections, typed here rather than inline in the
 * template: a union type cast inside a template expression is parsed as a
 * (deprecated) filter pipe by the Vue compiler.
 */
type Accent = 'sky' | 'gold' | 'brand'

const groups: readonly { key: string, items: readonly string[], accent: Accent }[] = [
  {
    key: 'data',
    items: ['collection', 'storage', 'transmission', 'deletion', 'children'],
    accent: 'sky',
  },
  { key: 'money', items: ['purchases', 'coins', 'chance', 'ads'], accent: 'gold' },
  { key: 'fairness', items: ['cosmetic', 'ai', 'targeting', 'upgrades'], accent: 'brand' },
]

usePageSeo(() => ({
  title: t('compliance.meta.title'),
  description: t('compliance.meta.description'),
}))
</script>

<template>
  <div>
    <header class="l-page-header bg-grain">
      <div
        class="comp__glow bg-glow-sky"
        aria-hidden="true"
      />
      <div class="l-container">
        <UiSectionHeading
          :level="1"
          :eyebrow="t('compliance.header.eyebrow')"
          :title="t('compliance.header.title')"
          :lead="t('compliance.header.lead')"
        />
        <p class="comp__updated">
          {{ t('compliance.updated') }}:
          <time :datetime="COMPLIANCE_REVIEWED">{{ COMPLIANCE_REVIEWED }}</time>
        </p>
      </div>
    </header>

    <section class="l-section--tight">
      <div class="l-container comp">
        <UiPanel
          v-for="group in groups"
          :key="group.key"
          :accent="group.accent"
        >
          <h2 class="comp__title">
            {{ t(`compliance.${group.key}.title`) }}
          </h2>
          <dl class="comp__definitions">
            <template
              v-for="item in group.items"
              :key="item"
            >
              <dt class="comp__term">
                {{ t(`compliance.${group.key}.items.${item}.term`) }}
              </dt>
              <dd class="comp__def">
                {{ t(`compliance.${group.key}.items.${item}.def`) }}
              </dd>
            </template>
          </dl>
        </UiPanel>

        <!-- Accessibility: implemented vs. known gaps, side by side. -->
        <UiPanel accent="brand">
          <h2 class="comp__title">
            {{ t('compliance.accessibility.title') }}
          </h2>
          <p class="comp__lead">
            {{ t('compliance.accessibility.lead') }}
          </p>

          <div class="comp__a11y">
            <div>
              <h3 class="comp__subtitle comp__subtitle--done">
                {{ t('compliance.accessibility.doneTitle') }}
              </h3>
              <ul class="comp__list comp__list--done">
                <li
                  v-for="(item, index) in accessibilityDone"
                  :key="index"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div>
              <h3 class="comp__subtitle comp__subtitle--gap">
                {{ t('compliance.accessibility.gapsTitle') }}
              </h3>
              <ul class="comp__list comp__list--gap">
                <li
                  v-for="(item, index) in accessibilityGaps"
                  :key="index"
                >
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
        </UiPanel>

        <UiPanel>
          <h2 class="comp__title">
            {{ t('compliance.content.title') }}
          </h2>
          <dl class="comp__definitions">
            <template
              v-for="item in contentItems"
              :key="item"
            >
              <dt class="comp__term">
                {{ t(`compliance.content.items.${item}.term`) }}
              </dt>
              <dd class="comp__def">
                {{ t(`compliance.content.items.${item}.def`) }}
              </dd>
            </template>
          </dl>
        </UiPanel>

        <UiPanel
          tone="sunken"
          class="comp__report"
        >
          <div>
            <h2 class="comp__title">
              {{ t('compliance.report.title') }}
            </h2>
            <p class="comp__lead">
              {{ t('compliance.report.body', { email: SITE.contactEmail }) }}
            </p>
          </div>
          <UiButton
            variant="secondary"
            :to="localePath('/contact')"
          >
            {{ t('compliance.report.cta') }}
          </UiButton>
        </UiPanel>

        <nav
          class="comp__links"
          :aria-label="t('footer.sections.site')"
        >
          <NuxtLink :to="localePath('/legal/privacy')">{{ t('nav.privacy') }}</NuxtLink>
          <NuxtLink :to="localePath('/legal/terms')">{{ t('nav.terms') }}</NuxtLink>
          <NuxtLink :to="localePath('/legal/cookies')">{{ t('nav.cookies') }}</NuxtLink>
        </nav>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.comp {
  display: grid;
  gap: var(--sp-4);
}

.comp__glow {
  position: absolute;
  inset: 0;
}

.comp__updated {
  margin-block-start: var(--sp-3);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}

.comp__title {
  font-size: var(--fs-lg);
}

.comp__lead {
  max-width: 72ch;
  margin-block-start: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.comp__subtitle {
  margin-block: var(--sp-4) var(--sp-2);
  font-family: var(--font-mono);
  font-size: rem(10.5);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.comp__subtitle--done {
  color: var(--c-success);
}

.comp__subtitle--gap {
  color: var(--c-warn);
}

.comp__definitions {
  display: grid;
  gap: 0 var(--sp-5);
  margin-block-start: var(--sp-3);

  @include mq('md') {
    grid-template-columns: rem(220) 1fr;
  }
}

.comp__term {
  padding-block: rem(9) rem(2);
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-text);

  @include mq('md') {
    padding-block: rem(9);
    border-block-end: 1px solid var(--c-hairline);
  }
}

.comp__def {
  padding-block: 0 rem(9);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
  border-block-end: 1px solid var(--c-hairline);

  @include mq('md') {
    padding-block: rem(9);
  }
}

.comp__a11y {
  display: grid;
  gap: var(--sp-4);

  @include mq('lg') {
    grid-template-columns: repeat(2, 1fr);
    align-items: start;
  }
}

.comp__list {
  display: grid;
  gap: var(--sp-2);

  li {
    position: relative;
    padding-inline-start: var(--sp-4);
    font-size: var(--fs-sm);
    color: var(--c-text-soft);

    &::before {
      position: absolute;
      inset-inline-start: 0;
      font-family: var(--font-mono);
      font-weight: 700;
    }
  }
}

.comp__list--done li::before {
  content: '✓';
  color: var(--c-success);
}

.comp__list--gap li::before {
  content: '!';
  color: var(--c-warn);
}

.comp__report {
  display: grid;
  gap: var(--sp-4);
  align-items: center;

  @include mq('md') {
    grid-template-columns: 1fr auto;
  }
}

.comp__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-4);
  padding-block-start: var(--sp-3);

  a {
    font-size: var(--fs-sm);
    color: var(--c-brand-soft);
    text-decoration: underline;
    text-underline-offset: 3px;
    border-radius: var(--r-xs);

    @include focus-visible(3px);
  }
}
</style>
