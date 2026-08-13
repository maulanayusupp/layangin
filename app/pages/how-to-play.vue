<script setup lang="ts">
/**
 * How to play.
 *
 * Structured as goal → controls → HUD → tactics → glossary → safety. The safety
 * note is not decoration: real abrasive line injures people, and the page says so
 * plainly rather than leaving it implied.
 */
const { t } = useI18n()
const localePath = useLocalePath()

const controlRows = ['haul', 'release', 'walk', 'snap'] as const
const readingItems = ['integrity', 'load', 'stamina', 'exchange', 'wind'] as const
const tacticItems = ['tension', 'angle', 'altitude', 'stamina'] as const
const glossaryItems = [
  'layangan',
  'sangkutan',
  'gelasan',
  'narik',
  'ngulur',
  'sentak',
  'putus',
  'sawangan',
  'janggan',
] as const

usePageSeo(() => ({
  title: t('howto.meta.title'),
  description: t('howto.meta.description'),
}))
</script>

<template>
  <div>
    <header class="l-page-header bg-grain">
      <div
        class="guide__glow bg-glow-sky"
        aria-hidden="true"
      />
      <div class="l-container">
        <UiSectionHeading
          :level="1"
          :eyebrow="t('howto.header.eyebrow')"
          :title="t('howto.header.title')"
          :lead="t('howto.header.lead')"
        />
      </div>
    </header>

    <section class="l-section--tight">
      <div class="l-container guide">
        <!-- Goal -->
        <UiPanel accent="brand">
          <h2 class="guide__title">
            {{ t('howto.goal.title') }}
          </h2>
          <p class="guide__body">
            {{ t('howto.goal.body') }}
          </p>
        </UiPanel>

        <!-- Controls -->
        <div class="guide__block">
          <UiSectionHeading
            :title="t('howto.controls.title')"
            :lead="t('howto.controls.lead')"
          />

          <div class="u-scroll-x">
            <table class="guide__table">
              <thead>
                <tr>
                  <th scope="col">
                    {{ t('game.controls.title') }}
                  </th>
                  <th scope="col">
                    {{ t('howto.controls.keyboardTitle') }}
                  </th>
                  <th scope="col">
                    {{ t('howto.controls.touchTitle') }}
                  </th>
                  <th scope="col">
                    {{ t('labels.stats') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in controlRows"
                  :key="row"
                >
                  <th scope="row">
                    {{ t(`howto.controls.rows.${row}.action`) }}
                  </th>
                  <td>
                    <kbd>{{ t(`howto.controls.rows.${row}.keys`) }}</kbd>
                  </td>
                  <td>{{ t(`howto.controls.rows.${row}.touch`) }}</td>
                  <td class="guide__effect">
                    {{ t(`howto.controls.rows.${row}.effect`) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- HUD -->
        <div class="guide__block">
          <UiSectionHeading :title="t('howto.reading.title')" />
          <dl class="prose guide__definitions">
            <template
              v-for="item in readingItems"
              :key="item"
            >
              <dt>{{ t(`howto.reading.items.${item}.term`) }}</dt>
              <dd>{{ t(`howto.reading.items.${item}.def`) }}</dd>
            </template>
          </dl>
        </div>

        <!-- Tactics -->
        <div class="guide__block">
          <UiSectionHeading :title="t('howto.tactics.title')" />
          <ul class="guide__tactics">
            <UiPanel
              v-for="(item, index) in tacticItems"
              :key="item"
              as="li"
              tone="sunken"
              :notch="index % 2 === 0 ? 'tr-bl' : 'tl-br'"
              class="guide__tactic"
            >
              <span class="guide__tactic-number t-num">{{ index + 1 }}</span>
              <h3 class="guide__tactic-title">
                {{ t(`howto.tactics.items.${item}.title`) }}
              </h3>
              <p class="guide__body">
                {{ t(`howto.tactics.items.${item}.body`) }}
              </p>
            </UiPanel>
          </ul>
        </div>

        <!-- Glossary -->
        <div class="guide__block">
          <UiSectionHeading
            :title="t('howto.glossary.title')"
            :lead="t('howto.glossary.lead')"
          />
          <dl class="guide__glossary">
            <div
              v-for="item in glossaryItems"
              :key="item"
              class="guide__term"
            >
              <dt>{{ t(`howto.glossary.items.${item}.term`) }}</dt>
              <dd>{{ t(`howto.glossary.items.${item}.def`) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Safety -->
        <UiPanel accent="danger">
          <h2 class="guide__title">
            {{ t('howto.safety.title') }}
          </h2>
          <p class="guide__body">
            {{ t('howto.safety.body') }}
          </p>
        </UiPanel>

        <UiPanel
          tone="sunken"
          class="guide__cta"
        >
          <div>
            <h2 class="guide__title">
              {{ t('howto.cta.title') }}
            </h2>
            <p class="guide__body">
              {{ t('howto.cta.body') }}
            </p>
          </div>
          <UiButton :to="localePath('/play')">
            {{ t('howto.cta.action') }}
          </UiButton>
        </UiPanel>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.guide {
  display: grid;
  gap: var(--sp-6);
}

.guide__glow {
  position: absolute;
  inset: 0;
}

.guide__block {
  display: grid;
  gap: var(--sp-4);
}

.guide__title {
  margin-block-end: var(--sp-2);
  font-size: var(--fs-lg);
}

.guide__body {
  max-width: 72ch;
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.guide__table {
  min-width: rem(640);
  font-size: var(--fs-sm);

  th,
  td {
    padding: var(--sp-3);
    text-align: start;
    vertical-align: top;
    border-block-end: 1px solid var(--c-hairline);
  }

  thead th {
    font-family: var(--font-mono);
    font-size: rem(10);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-text-mute);
  }

  tbody th {
    font-weight: 700;
    color: var(--c-text);
    white-space: nowrap;
  }
}

.guide__effect {
  max-width: 42ch;
  color: var(--c-text-soft);
}

.guide__definitions {
  max-width: none;
}

.guide__tactics {
  display: grid;
  gap: var(--sp-3);

  @include mq('md') {
    grid-template-columns: repeat(2, 1fr);
  }
}

.guide__tactic {
  display: grid;
  gap: var(--sp-2);
  align-content: start;
}

.guide__tactic-number {
  font-family: var(--font-display);
  font-size: var(--fs-xl);
  line-height: 1;

  @include gradient-text;
}

.guide__tactic-title {
  font-size: var(--fs-md);
}

.guide__glossary {
  display: grid;
  gap: var(--sp-3);

  @include mq('sm') {
    grid-template-columns: repeat(2, 1fr);
  }

  @include mq('lg') {
    grid-template-columns: repeat(3, 1fr);
  }
}

.guide__term {
  padding: var(--sp-3);
  border-inline-start: 2px solid var(--c-brand);
  background: var(--c-surface-sunken);

  dt {
    font-family: var(--font-display);
    font-size: var(--fs-base);
    font-weight: 700;
  }

  dd {
    margin-block-start: rem(2);
    font-size: var(--fs-sm);
    color: var(--c-text-soft);
  }
}

.guide__cta {
  display: grid;
  gap: var(--sp-4);
  align-items: center;

  @include mq('md') {
    grid-template-columns: 1fr auto;
  }
}
</style>
