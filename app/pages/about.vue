<script setup lang="ts">
import { SITE } from '~~/shared/constants/site'

/**
 * About page.
 *
 * Includes an explicit "what is not simulated" section. That is the part most
 * projects leave out, and it is the part that keeps the physics claims elsewhere
 * on the site honest.
 */
const { t, tm, rt } = useI18n()
const localePath = useLocalePath()

/** `tm` returns the raw message array; `rt` renders each entry. */
const simulated = computed(() => (tm('about.simulated.items') as unknown[]).map(item => rt(item as string)))
const notSimulated = computed(() =>
  (tm('about.notSimulated.items') as unknown[]).map(item => rt(item as string)),
)

const techItems = ['framework', 'render', 'state', 'i18n', 'hosting'] as const

usePageSeo(() => ({
  title: t('about.meta.title'),
  description: t('about.meta.description'),
}))
</script>

<template>
  <div>
    <header class="l-page-header bg-grain">
      <div
        class="about__glow bg-glow-brand"
        aria-hidden="true"
      />
      <div class="l-container">
        <UiSectionHeading
          :level="1"
          :eyebrow="t('about.header.eyebrow')"
          :title="t('about.header.title')"
          :lead="t('about.header.lead')"
        />
      </div>
    </header>

    <section class="l-section--tight">
      <div class="l-container about">
        <div class="about__block">
          <h2 class="about__title">
            {{ t('about.why.title') }}
          </h2>
          <p class="prose">
            {{ t('about.why.body') }}
          </p>
        </div>

        <div class="about__pair">
          <UiPanel accent="sky">
            <h2 class="about__title">
              {{ t('about.simulated.title') }}
            </h2>
            <ul class="about__list">
              <li
                v-for="(item, index) in simulated"
                :key="index"
              >
                {{ item }}
              </li>
            </ul>
          </UiPanel>

          <UiPanel accent="gold">
            <h2 class="about__title">
              {{ t('about.notSimulated.title') }}
            </h2>
            <p class="about__lead">
              {{ t('about.notSimulated.lead') }}
            </p>
            <ul class="about__list">
              <li
                v-for="(item, index) in notSimulated"
                :key="index"
              >
                {{ item }}
              </li>
            </ul>
          </UiPanel>
        </div>

        <div class="about__block">
          <h2 class="about__title">
            {{ t('about.cultural.title') }}
          </h2>
          <p class="prose">
            {{ t('about.cultural.body') }}
          </p>
          <p class="about__note">
            {{ t('about.cultural.note') }}
          </p>
        </div>

        <div class="about__block">
          <h2 class="about__title">
            {{ t('about.tech.title') }}
          </h2>
          <dl class="about__tech">
            <template
              v-for="item in techItems"
              :key="item"
            >
              <dt class="about__tech-term">
                {{ t(`about.tech.items.${item}.term`) }}
              </dt>
              <dd class="about__tech-def">
                {{ t(`about.tech.items.${item}.def`) }}
              </dd>
            </template>
          </dl>
        </div>

        <UiPanel
          tone="sunken"
          class="about__author"
        >
          <div>
            <h2 class="about__title">
              {{ t('about.author.title') }}
            </h2>
            <p class="about__lead">
              {{ t('about.author.body', { name: SITE.contactName }) }}
            </p>
          </div>
          <UiButton
            variant="secondary"
            :to="localePath('/contact')"
          >
            {{ t('about.author.cta') }}
          </UiButton>
        </UiPanel>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.about {
  display: grid;
  gap: var(--sp-6);
}

.about__glow {
  position: absolute;
  inset: 0;
}

.about__block {
  display: grid;
  gap: var(--sp-3);
}

.about__title {
  font-size: var(--fs-lg);
}

.about__lead {
  max-width: 68ch;
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.about__note {
  max-width: 68ch;
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}

.about__pair {
  display: grid;
  gap: var(--sp-4);

  @include mq('lg') {
    grid-template-columns: repeat(2, 1fr);
    align-items: start;
  }
}

.about__list {
  display: grid;
  gap: var(--sp-2);
  margin-block-start: var(--sp-3);

  li {
    position: relative;
    padding-inline-start: var(--sp-4);
    font-size: var(--fs-sm);
    color: var(--c-text-soft);

    &::before {
      content: '';
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: 0.6em;
      width: rem(7);
      height: rem(7);
      background: var(--c-brand);
      clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
    }
  }
}

.about__tech {
  display: grid;
  gap: 0 var(--sp-4);
  max-width: rem(760);

  @include mq('sm') {
    grid-template-columns: rem(160) 1fr;
  }
}

.about__tech-term {
  padding-block: rem(8);
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-text);

  @include mq('sm') {
    border-block-end: 1px solid var(--c-hairline);
  }
}

.about__tech-def {
  padding-block: 0 rem(8);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
  border-block-end: 1px solid var(--c-hairline);

  @include mq('sm') {
    padding-block: rem(8);
  }
}

.about__author {
  display: grid;
  gap: var(--sp-4);
  align-items: center;

  @include mq('md') {
    grid-template-columns: 1fr auto;
  }
}
</style>
