<script setup lang="ts">
/**
 * FAQ, built from native `<details>` elements.
 *
 * The platform disclosure gives keyboard operation, correct expanded state for
 * assistive technology and in-page find-on-page search of collapsed text — none
 * of which a hand-rolled accordion gets for free.
 */
const { t } = useI18n()

const items = ['free', 'account', 'device', 'pvp', 'offline'] as const
</script>

<template>
  <section class="faq l-section">
    <div class="l-container">
      <UiSectionHeading
        :eyebrow="t('home.faq.eyebrow')"
        :title="t('home.faq.title')"
      />

      <ul class="faq__list">
        <li
          v-for="key in items"
          :key="key"
        >
          <details class="faq__item">
            <summary class="faq__question">
              <span>{{ t(`home.faq.items.${key}.q`) }}</span>
              <span
                class="faq__icon"
                aria-hidden="true"
              />
            </summary>
            <p class="faq__answer">
              {{ t(`home.faq.items.${key}.a`) }}
            </p>
          </details>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.faq__list {
  display: grid;
  gap: var(--sp-2);
  margin-block-start: var(--sp-5);
}

.faq__item {
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-md);
  background: var(--c-surface-sunken);
  transition: border-color var(--dur-fast) var(--ease-out);

  &[open] {
    border-color: var(--c-border);
  }
}

.faq__question {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  min-height: rem(52);
  padding: var(--sp-3) var(--sp-4);
  font-family: var(--font-display);
  font-size: var(--fs-base);
  font-weight: 700;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }

  @include focus-visible(-2px);
}

.faq__icon {
  position: relative;
  flex: none;
  width: rem(14);
  height: rem(14);

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 0;
    width: 100%;
    height: rem(2);
    border-radius: var(--r-pill);
    background: var(--c-brand);
    translate: 0 -50%;
    transition: rotate var(--dur-fast) var(--ease-out);
  }

  &::after {
    rotate: 90deg;
  }
}

.faq__item[open] .faq__icon::after {
  rotate: 0deg;
}

.faq__answer {
  max-width: 72ch;
  padding: 0 var(--sp-4) var(--sp-4);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}
</style>
