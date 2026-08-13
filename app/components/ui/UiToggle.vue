<script setup lang="ts">
/**
 * Settings switch.
 *
 * A real `<input type="checkbox">` under a styled track: keyboard, form
 * semantics and screen-reader state all come free, and the visual is drawn from
 * the checked state rather than from a script.
 */
const props = defineProps<{
  modelValue: boolean
  label: string
  description?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const id = useId()
const descriptionId = computed(() => (props.description ? `${id}-description` : undefined))
</script>

<template>
  <div class="toggle">
    <input
      :id="id"
      class="toggle__input"
      type="checkbox"
      :checked="modelValue"
      :aria-describedby="descriptionId"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    >
    <label
      class="toggle__label"
      :for="id"
    >
      <span
        class="toggle__track"
        aria-hidden="true"
      ><span class="toggle__knob" /></span>
      <span class="toggle__text">
        <span class="toggle__title">{{ label }}</span>
        <span
          v-if="description"
          :id="descriptionId"
          class="toggle__description"
        >
          {{ description }}
        </span>
      </span>
    </label>
  </div>
</template>

<style scoped lang="scss">
.toggle {
  position: relative;
}

.toggle__input {
  @include visually-hidden;
}

.toggle__label {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--sp-3);
  align-items: start;
  cursor: pointer;
  padding-block: rem(4);
}

.toggle__track {
  position: relative;
  flex: none;
  width: rem(44);
  height: rem(26);
  margin-block-start: rem(2);
  border: 1px solid var(--c-border);
  border-radius: var(--r-pill);
  background: var(--c-surface-sunken);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.toggle__knob {
  position: absolute;
  inset-block-start: rem(3);
  inset-inline-start: rem(3);
  width: rem(18);
  height: rem(18);
  border-radius: 50%;
  background: var(--c-text-mute);
  transition:
    translate var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.toggle__title {
  display: block;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-text);
}

.toggle__description {
  display: block;
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}

.toggle__input:checked + .toggle__label .toggle__track {
  border-color: transparent;
  background: var(--g-sky);
}

.toggle__input:checked + .toggle__label .toggle__knob {
  translate: rem(18) 0;
  background: #04241f;
}

.toggle__input:focus-visible + .toggle__label .toggle__track {
  @include focus-ring(2px);
}
</style>
