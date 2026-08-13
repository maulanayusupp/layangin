<script setup lang="ts">
import { SITE } from '~~/shared/constants/site'

/**
 * Contact page.
 *
 * Email only, deliberately: there is no backend to receive a form, so a contact
 * form would either be a lie or an embedded third-party service that collects
 * data the privacy page says is not collected. A `mailto:` link and a copy button
 * are the honest version.
 */
const { t, tm, rt } = useI18n()

const expectItems = computed(() =>
  (tm('contact.expect.items') as unknown[]).map(item => rt(item as string)),
)
const goodItems = computed(() =>
  (tm('contact.good.items') as unknown[]).map(item => rt(item as string)),
)

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

async function copyEmail(): Promise<void> {
  try {
    await navigator.clipboard.writeText(SITE.contactEmail)
    copied.value = true
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      copied.value = false
    }, 2200)
  }
  catch {
    // Clipboard access can be denied. The address is visible as text and the
    // mailto link still works, so there is nothing to recover from.
  }
}

onBeforeUnmount(() => clearTimeout(resetTimer))

usePageSeo(() => ({
  title: t('contact.meta.title'),
  description: t('contact.meta.description'),
}))
</script>

<template>
  <div>
    <header class="l-page-header bg-grain">
      <div
        class="contact__glow bg-glow-sky"
        aria-hidden="true"
      />
      <div class="l-container">
        <UiSectionHeading
          :level="1"
          :eyebrow="t('contact.header.eyebrow')"
          :title="t('contact.header.title')"
          :lead="t('contact.header.lead')"
        />
      </div>
    </header>

    <section class="l-section--tight">
      <div class="l-container contact">
        <UiPanel
          accent="brand"
          class="contact__card"
        >
          <p class="contact__label">
            {{ t('contact.email.label') }}
          </p>
          <p class="contact__name">
            {{ t('contact.email.name') }}
          </p>

          <p class="contact__address">
            <a :href="`mailto:${SITE.contactEmail}`">{{ SITE.contactEmail }}</a>
          </p>

          <div class="contact__actions">
            <UiButton :href="`mailto:${SITE.contactEmail}`">
              {{ t('contact.email.cta') }}
            </UiButton>
            <ClientOnly>
              <UiButton
                variant="ghost"
                @click="copyEmail"
              >
                {{ copied ? t('actions.copied') : t('actions.copyEmail') }}
              </UiButton>
            </ClientOnly>
          </div>

          <p class="contact__note">
            {{ t('contact.email.note') }}
          </p>

          <p
            aria-live="polite"
            class="visually-hidden"
          >
            {{ copied ? t('actions.copied') : '' }}
          </p>
        </UiPanel>

        <div class="contact__pair">
          <UiPanel tone="sunken">
            <h2 class="contact__title">
              {{ t('contact.expect.title') }}
            </h2>
            <ul class="contact__list">
              <li
                v-for="(item, index) in expectItems"
                :key="index"
              >
                {{ item }}
              </li>
            </ul>
          </UiPanel>

          <UiPanel tone="sunken">
            <h2 class="contact__title">
              {{ t('contact.good.title') }}
            </h2>
            <ul class="contact__list">
              <li
                v-for="(item, index) in goodItems"
                :key="index"
              >
                {{ item }}
              </li>
            </ul>
          </UiPanel>
        </div>

        <UiHint
          hint-id="contact-privacy"
          persistent
        >
          {{ t('contact.privacyNote') }}
        </UiHint>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.contact {
  display: grid;
  gap: var(--sp-5);
}

.contact__glow {
  position: absolute;
  inset: 0;
}

.contact__card {
  display: grid;
  gap: var(--sp-2);
}

.contact__label {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.contact__name {
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  font-weight: 700;
}

.contact__address {
  font-family: var(--font-mono);
  font-size: var(--fs-md);
  word-break: break-all;

  a {
    color: var(--c-brand-soft);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    border-radius: var(--r-xs);

    @include focus-visible(3px);

    @include hover {
      color: var(--c-brand);
    }
  }
}

.contact__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-block-start: var(--sp-2);
}

.contact__note {
  max-width: 60ch;
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}

.contact__pair {
  display: grid;
  gap: var(--sp-4);

  @include mq('md') {
    grid-template-columns: repeat(2, 1fr);
    align-items: start;
  }
}

.contact__title {
  margin-block-end: var(--sp-3);
  font-size: var(--fs-md);
}

.contact__list {
  display: grid;
  gap: var(--sp-2);

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
      background: var(--c-sky);
      clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
    }
  }
}
</style>
