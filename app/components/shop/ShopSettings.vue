<script setup lang="ts">
/**
 * Preferences and the destructive reset, kept together at the bottom of the shop
 * where they will not be hit by accident.
 *
 * The reset goes through a confirmation dialog because it wipes progress with no
 * way back — see `/legal/terms`.
 */
const { t } = useI18n()
const settings = useSettingsStore()
const player = usePlayerStore()

const confirming = ref(false)
const done = ref(false)

function reset(): void {
  player.resetProgress()
  confirming.value = false
  done.value = true
}
</script>

<template>
  <UiPanel class="settings">
    <UiSectionHeading
      :level="2"
      :title="t('shop.settings.title')"
    />

    <ClientOnly>
      <div class="settings__toggles">
        <UiToggle
          :model-value="settings.state.reducedEffects"
          :label="t('shop.settings.reducedEffects.label')"
          :description="t('shop.settings.reducedEffects.description')"
          @update:model-value="settings.setReducedEffects"
        />
      </div>
    </ClientOnly>

    <UiRule />

    <h3 class="settings__subtitle">
      {{ t('shop.reset.title') }}
    </h3>
    <p class="settings__body">
      {{ t('shop.reset.body') }}
    </p>

    <div class="settings__actions">
      <UiButton
        variant="danger"
        size="sm"
        @click="confirming = true"
      >
        {{ t('shop.reset.action') }}
      </UiButton>
      <UiButton
        variant="ghost"
        size="sm"
        @click="settings.restoreHints()"
      >
        {{ t('hint.showAgain') }}
      </UiButton>
    </div>

    <p
      v-if="done"
      class="settings__done"
      role="status"
    >
      {{ t('shop.reset.done') }}
    </p>

    <UiModal
      :open="confirming"
      :title="t('shop.reset.title')"
      size="sm"
      @close="confirming = false"
    >
      <p>{{ t('shop.reset.body') }}</p>

      <template #footer>
        <UiButton
          variant="ghost"
          size="sm"
          @click="confirming = false"
        >
          {{ t('actions.cancel') }}
        </UiButton>
        <UiButton
          variant="danger"
          size="sm"
          @click="reset"
        >
          {{ t('shop.reset.confirm') }}
        </UiButton>
      </template>
    </UiModal>
  </UiPanel>
</template>

<style scoped lang="scss">
.settings {
  display: grid;
  gap: var(--sp-4);
}

.settings__toggles {
  display: grid;
  gap: var(--sp-3);
}

.settings__subtitle {
  font-size: var(--fs-md);
}

.settings__body {
  max-width: 64ch;
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.settings__done {
  font-size: var(--fs-sm);
  color: var(--c-success);
}
</style>
