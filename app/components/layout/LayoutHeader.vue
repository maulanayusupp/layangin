<script setup lang="ts">
/**
 * Site header.
 *
 * On small screens the navigation collapses into a disclosure panel rather than
 * an overlay: it keeps the header in the document flow, needs no focus trap, and
 * closes on route change. `aria-current` marks the active page.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const open = ref(false)
const panelId = useId()

const links = computed(() => [
  { to: localePath('/play'), label: t('nav.play') },
  { to: localePath('/kites'), label: t('nav.kites') },
  { to: localePath('/shop'), label: t('nav.shop') },
  { to: localePath('/how-to-play'), label: t('nav.howToPlay') },
  { to: localePath('/about'), label: t('nav.about') },
])

// Navigating away must not leave a stale open panel behind.
watch(() => route.fullPath, () => {
  open.value = false
})
</script>

<template>
  <header class="header">
    <div class="header__inner l-container--wide">
      <NuxtLink
        class="header__brand"
        :to="localePath('/')"
        :aria-label="t('nav.brandHome')"
      >
        <BrandLogo size="sm" />
      </NuxtLink>

      <nav
        class="header__nav u-desktop-only"
        :aria-label="t('nav.home')"
      >
        <ul class="header__list">
          <li
            v-for="link in links"
            :key="link.to"
          >
            <NuxtLink
              class="header__link"
              :to="link.to"
            >{{ link.label }}</NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="header__actions">
        <LayoutCoinBalance
          compact
          class="u-desktop-only"
        />
        <LayoutLocaleSwitcher />

        <UiButton
          class="u-desktop-only"
          size="sm"
          variant="primary"
          :to="localePath('/play')"
        >
          {{ t('actions.play') }}
        </UiButton>

        <button
          type="button"
          class="header__toggle u-mobile-only"
          :aria-expanded="open"
          :aria-controls="panelId"
          :aria-label="open ? t('a11y.closeMenu') : t('a11y.openMenu')"
          @click="open = !open"
        >
          <span
            class="header__bars"
            :class="{ 'is-open': open }"
            aria-hidden="true"
          >
            <span /><span /><span />
          </span>
        </button>
      </div>
    </div>

    <div
      :id="panelId"
      class="header__panel u-mobile-only"
      :class="{ 'is-open': open }"
    >
      <nav :aria-label="t('nav.home')">
        <ul class="header__panel-list">
          <li
            v-for="link in links"
            :key="link.to"
          >
            <NuxtLink
              class="header__panel-link"
              :to="link.to"
            >{{ link.label }}</NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="header__panel-foot">
        <LayoutCoinBalance />
        <UiButton
          size="sm"
          :to="localePath('/play')"
        >
          {{ t('actions.play') }}
        </UiButton>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.header {
  position: sticky;
  inset-block-start: 0;
  z-index: var(--z-header);
  border-block-end: 1px solid var(--c-hairline);
  background: color-mix(in srgb, var(--c-ink-900) 82%, transparent);
  backdrop-filter: blur(rem(14)) saturate(140%);
}

.header__inner {
  display: flex;
  gap: var(--sp-4);
  align-items: center;
  justify-content: space-between;
  min-height: var(--header-h);
}

.header__brand {
  border-radius: var(--r-sm);

  @include focus-visible(4px);
}

.header__nav {
  flex: 1;
  margin-inline-start: var(--sp-4);
}

.header__list {
  display: flex;
  gap: var(--sp-1);
}

.header__link {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: rem(38);
  padding-inline: rem(11);
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-text-soft);
  border-radius: var(--r-sm);
  transition: color var(--dur-fast) var(--ease-out);

  @include focus-visible(2px);

  @include hover {
    color: var(--c-text);
  }

  // Active page marker: a rhombus under the label, not an underline.
  &::after {
    content: '';
    position: absolute;
    inset-block-end: rem(2);
    inset-inline-start: 50%;
    width: rem(6);
    height: rem(6);
    background: var(--c-brand);
    clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
    opacity: 0;
    translate: -50% 0;
    transition: opacity var(--dur-fast) var(--ease-out);
  }

  &.router-link-active {
    color: var(--c-text);

    &::after {
      opacity: 1;
    }
  }
}

.header__actions {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
}

.header__toggle {
  display: grid;
  place-items: center;
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-sm);

  @include tap-target(40px);
  @include focus-visible(2px);
}

.header__bars {
  display: grid;
  gap: rem(4);

  > span {
    display: block;
    width: rem(17);
    height: rem(2);
    border-radius: var(--r-pill);
    background: var(--c-text);
    transition:
      translate var(--dur-fast) var(--ease-out),
      rotate var(--dur-fast) var(--ease-out),
      opacity var(--dur-fast) var(--ease-out);
  }

  &.is-open > span:nth-child(1) {
    translate: 0 rem(6);
    rotate: 45deg;
  }

  &.is-open > span:nth-child(2) {
    opacity: 0;
  }

  &.is-open > span:nth-child(3) {
    translate: 0 rem(-6);
    rotate: -45deg;
  }
}

.header__panel {
  display: grid;
  overflow: hidden;
  // Collapsed by default; `grid-template-rows` animates where `height: auto`
  // cannot, so no JavaScript measurement is needed.
  grid-template-rows: 0fr;
  border-block-start: 1px solid transparent;
  transition:
    grid-template-rows var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out);

  @include reduced-motion {
    transition: none;
  }

  &.is-open {
    grid-template-rows: 1fr;
    border-block-start-color: var(--c-hairline);
  }

  > nav {
    overflow: hidden;
  }
}

/**
 * Two columns on the mobile menu.
 *
 * A single 48px-tall column of five links left a tall band of empty space with
 * one word per row. Pairing them halves the height while each cell still clears
 * the 44px tap-target minimum.
 */
.header__panel-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 var(--sp-3);
  padding: var(--sp-1) var(--gutter);
}

.header__panel-link {
  display: flex;
  align-items: center;
  min-height: rem(44);
  font-family: var(--font-display);
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--c-text-soft);
  border-block-end: 1px solid var(--c-hairline);

  @include focus-visible(2px);

  &.router-link-active {
    color: var(--c-brand-soft);
  }
}

/// An odd link count leaves a gap in the last row; stretch that item across.
/// The grid children are the `<li>` wrappers, not the links themselves.
.header__panel-list > li:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.header__panel-list > li {
  display: grid;
}

.header__panel-foot {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--gutter);
  padding-block-end: max(var(--sp-3), env(safe-area-inset-bottom));
}

.header__panel:not(.is-open) .header__panel-foot {
  visibility: hidden;
}
</style>
