<script setup lang="ts">
/**
 * "What is actually simulated" section.
 *
 * Each card pairs a claim with a small CSS diagram of the effect, so the section
 * demonstrates rather than asserts. The diagrams are decorative; the text carries
 * the meaning.
 */
const { t } = useI18n()

const items = ['wind', 'aero', 'line', 'clash'] as const
</script>

<template>
  <section class="physics l-section bg-glow-sky u-relative">
    <div class="l-container--wide">
      <UiSectionHeading
        :eyebrow="t('home.physics.eyebrow')"
        :title="t('home.physics.title')"
        :lead="t('home.physics.lead')"
      />

      <ul class="physics__grid">
        <UiPanel
          v-for="(key, index) in items"
          :key="key"
          as="li"
          interactive
          :notch="index % 2 === 0 ? 'tr-bl' : 'tl-br'"
          class="physics__card"
        >
          <div
            class="physics__diagram"
            :class="`physics__diagram--${key}`"
            aria-hidden="true"
          >
            <!-- Wind shear: bars growing with height. -->
            <template v-if="key === 'wind'">
              <span
                v-for="i in 6"
                :key="i"
                v-css-vars="{ i }"
                class="physics__bar"
              />
            </template>

            <!-- Lift curve: peaks then collapses. -->
            <svg
              v-else-if="key === 'aero'"
              viewBox="0 0 120 60"
              class="physics__svg"
            >
              <path
                d="M4 56 C 24 4, 56 2, 68 22 C 78 40, 96 54, 116 56"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <circle
                cx="62"
                cy="12"
                r="3.5"
                fill="currentColor"
              />
            </svg>

            <!-- Line sag: slack curve against a taut one. -->
            <svg
              v-else-if="key === 'line'"
              viewBox="0 0 120 60"
              class="physics__svg"
            >
              <path
                d="M6 54 L 114 10"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
                opacity="0.4"
              />
              <path
                d="M6 54 Q 60 62, 114 10"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>

            <!-- Clash: two lines crossing with a spark at the contact. -->
            <svg
              v-else
              viewBox="0 0 120 60"
              class="physics__svg"
            >
              <path
                d="M6 52 L 108 8"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <path
                d="M12 8 L 114 52"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                opacity="0.55"
              />
              <circle
                cx="60"
                cy="30"
                r="6"
                class="physics__spark"
              />
            </svg>
          </div>

          <h3 class="physics__title">
            {{ t(`home.physics.items.${key}.title`) }}
          </h3>
          <p class="physics__body">
            {{ t(`home.physics.items.${key}.body`) }}
          </p>
        </UiPanel>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.physics__grid {
  display: grid;
  gap: var(--sp-4);
  margin-block-start: var(--sp-6);

  @include mq('sm') {
    grid-template-columns: repeat(2, 1fr);
  }

  @include mq('xl') {
    grid-template-columns: repeat(4, 1fr);
  }
}

.physics__card {
  display: grid;
  gap: var(--sp-3);
  align-content: start;
}

.physics__diagram {
  display: flex;
  gap: rem(5);
  align-items: end;
  justify-content: center;
  height: rem(74);
  padding: var(--sp-3);
  color: var(--c-brand);
  border-radius: var(--r-sm);
  background: var(--c-surface-sunken);
}

.physics__svg {
  width: 100%;
  height: 100%;
  color: var(--c-sky);
}

.physics__bar {
  // Six bars, each taller than the last: the wind profile made literal.
  width: rem(9);
  height: calc(14% + var(--i) * 14%);
  border-radius: var(--r-xs) var(--r-xs) 0 0;
  background: linear-gradient(180deg, var(--c-brand), transparent);
  opacity: calc(0.35 + var(--i) * 0.11);
}

.physics__spark {
  fill: var(--c-gold);
  animation: pop-in 1.6s var(--ease-out) infinite alternate;

  @include reduced-motion {
    animation: none;
  }
}

.physics__title {
  font-size: var(--fs-md);
}

.physics__body {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}
</style>
