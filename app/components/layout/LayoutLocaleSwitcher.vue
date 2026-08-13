<script setup lang="ts">
/**
 * Language switcher.
 *
 * Rendered as real links to the localised route rather than a JavaScript
 * switcher, so each language has a crawlable URL and the choice survives a
 * hard reload. The current language is marked with `aria-current`.
 *
 * Selecting a language also records it in settings, which is what the i18n
 * cookie then remembers on the next visit.
 */
const { locale, locales, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const settings = useSettingsStore()

const available = computed(() =>
  (locales.value as { code: string, name?: string }[]).map(entry => ({
    code: entry.code,
    name: entry.name ?? entry.code,
    // A two-letter tag is all that fits in the header at mobile width.
    short: entry.code.toUpperCase(),
    path: switchLocalePath(entry.code as 'en' | 'id'),
  })),
)
</script>

<template>
  <nav
    class="locale"
    :aria-label="t('a11y.localeSwitcher')"
  >
    <ul class="locale__list">
      <li
        v-for="entry in available"
        :key="entry.code"
      >
        <NuxtLink
          class="locale__item"
          :class="{ 'is-active': entry.code === locale }"
          :to="entry.path"
          :aria-current="entry.code === locale ? 'true' : undefined"
          :hreflang="entry.code"
          @click="settings.setLocale(entry.code)"
        >
          <span aria-hidden="true">{{ entry.short }}</span>
          <span class="visually-hidden">{{ entry.name }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped lang="scss">
.locale__list {
  display: flex;
  gap: rem(2);
  padding: rem(3);
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-pill);
  background: var(--c-surface-sunken);
}

.locale__item {
  display: grid;
  place-items: center;
  min-width: rem(36);
  min-height: rem(30);
  padding-inline: rem(8);
  font-family: var(--font-mono);
  font-size: rem(11);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--c-text-mute);
  border-radius: var(--r-pill);
  transition:
    color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);

  @include focus-visible(2px);

  @include hover {
    color: var(--c-text);
  }

  &.is-active {
    color: var(--c-text-on-brand);
    background: var(--c-brand);
  }
}
</style>
