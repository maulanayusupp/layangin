<script setup lang="ts">
/**
 * Shared shell for the three legal pages.
 *
 * They differ only in their sections, so the header, the "not legal advice"
 * disclaimer, the updated date and the cross-links live here once. That is what
 * keeps the three pages from drifting apart in tone or structure.
 */
defineProps<{
  eyebrow: string
  title: string
  lead: string
  updated: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const links = computed(() => [
  { to: localePath('/legal/privacy'), label: t('nav.privacy') },
  { to: localePath('/legal/terms'), label: t('nav.terms') },
  { to: localePath('/legal/cookies'), label: t('nav.cookies') },
  { to: localePath('/compliance'), label: t('nav.compliance') },
])
</script>

<template>
  <div>
    <header class="l-page-header bg-grain">
      <div
        class="legal__glow bg-glow-brand"
        aria-hidden="true"
      />
      <div class="l-container--narrow">
        <UiSectionHeading
          :level="1"
          :eyebrow="eyebrow"
          :title="title"
          :lead="lead"
        />
        <p class="legal__updated">
          {{ t('legal.updated') }}: <time :datetime="updated">{{ updated }}</time>
        </p>
      </div>
    </header>

    <section class="l-section--tight">
      <div class="l-container--narrow legal">
        <UiHint
          hint-id="legal-disclaimer"
          persistent
        >
          {{ t('legal.notLegalAdvice') }}
        </UiHint>

        <div class="prose">
          <slot />
        </div>

        <nav
          class="legal__links"
          :aria-label="t('footer.sections.site')"
        >
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.legal {
  display: grid;
  gap: var(--sp-5);
}

.legal__glow {
  position: absolute;
  inset: 0;
}

.legal__updated {
  margin-block-start: var(--sp-3);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}

.legal__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-4);
  padding-block-start: var(--sp-4);
  border-block-start: 1px solid var(--c-hairline);

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
