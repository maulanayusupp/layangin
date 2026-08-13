<script setup lang="ts">
/**
 * Standard page shell: skip link, header, main landmark, footer.
 *
 * The skip link is first in the DOM so it is the very first thing a keyboard user
 * reaches, and it targets `#main` which every page renders into.
 */
const { t } = useI18n()
const player = usePlayerStore()
</script>

<template>
  <div class="shell">
    <a
      class="skip-link"
      href="#main"
    >{{ t('a11y.skipToContent') }}</a>

    <LayoutHeader />

    <main
      id="main"
      class="shell__main"
    >
      <!--
        Storage failures are silent otherwise: the player would earn coins all
        session and lose them on reload with no explanation.
      -->
      <ClientOnly>
        <div
          v-if="player.storageBlocked"
          class="shell__notice"
        >
          <div class="l-container">
            <UiHint
              hint-id="storage-blocked"
              tone="warning"
              persistent
            >
              <strong>{{ t('storage.blockedTitle') }}</strong> — {{ t('storage.blockedBody') }}
            </UiHint>
          </div>
        </div>
      </ClientOnly>

      <slot />
    </main>

    <LayoutFooter />
  </div>
</template>

<style scoped lang="scss">
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.shell__main {
  flex: 1;
}

.shell__notice {
  padding-block-start: var(--sp-4);
}
</style>
