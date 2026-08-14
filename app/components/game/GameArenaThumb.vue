<script setup lang="ts">
import { arenaHazards } from '~/data/arenas'
import type { ArenaDefinition } from '~/services/game/types'

/**
 * A field, drawn from its own palette.
 *
 * Sky gradient, ridge line, ground band and — when the arena actually has cables
 * in it — a pair of wires. Every colour comes from the arena definition, so the
 * thumbnail is the real thing rather than an illustration that can drift away from
 * it. Extracted so the picker and the setup screen cannot disagree about what a
 * field looks like.
 *
 * Decorative: the arena's name is always alongside it, so this is `aria-hidden`.
 */
const props = withDefaults(
  defineProps<{
    arena: ArenaDefinition
    /**
     * Shape of the frame. Matches `KitePreview`'s vocabulary so a row of cards can
     * put a kite and a field side by side and have them come out the same height.
     */
    ratio?: '16/9' | '4/3' | '1'
  }>(),
  { ratio: '16/9' },
)

const hazards = computed(() => arenaHazards(props.arena))

/** Sky stops → a CSS gradient, so the thumbnail is the real arena palette. */
const sky = computed(() => {
  const stops = props.arena.sky.map(
    ([offset, color]) => `${color} ${Math.round(offset * 100)}%`,
  )
  return `linear-gradient(180deg, ${stops.join(', ')})`
})

const ridge = computed(
  () => props.arena.ridges[props.arena.ridges.length - 1] ?? props.arena.ground,
)
</script>

<template>
  <div
    v-css-vars="{
      sky,
      ground: arena.ground,
      ridge,
      sun: arena.sun.color,
    }"
    class="thumb"
    :class="`thumb--ratio-${ratio.replace('/', '-')}`"
    aria-hidden="true"
  >
    <span class="thumb__sun" />
    <span class="thumb__ridge" />
    <span class="thumb__ground" />
    <span
      v-if="hazards.cableCount > 0"
      class="thumb__cables"
    />
  </div>
</template>

<style scoped lang="scss">
.thumb {
  position: relative;
  overflow: hidden;
  border-radius: var(--r-sm);
  background: var(--sky);
}

.thumb--ratio-16-9 {
  aspect-ratio: 16 / 9;
}

.thumb--ratio-4-3 {
  aspect-ratio: 4 / 3;
}

.thumb--ratio-1 {
  aspect-ratio: 1;
}

.thumb__sun {
  position: absolute;
  inset-block-start: 24%;
  inset-inline-end: 18%;
  width: 16%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--sun);
  opacity: 0.85;
  filter: blur(rem(1));
}

.thumb__ridge {
  position: absolute;
  inset: auto 0 22% 0;
  height: 26%;
  background: var(--ridge);
  clip-path: polygon(0 100%, 0 46%, 18% 22%, 38% 54%, 58% 18%, 78% 50%, 100% 30%, 100% 100%);
  opacity: 0.9;
}

.thumb__ground {
  position: absolute;
  inset: auto 0 0 0;
  height: 24%;
  background: var(--ground);
}

/// Two wires across the sky — the one hazard worth reading at a glance.
.thumb__cables {
  position: absolute;
  inset: 34% 0 auto 0;
  height: 22%;
  background:
    linear-gradient(transparent 38%, rgb(255 255 255 / 42%) 38% 42%, transparent 42%),
    linear-gradient(transparent 72%, rgb(255 255 255 / 30%) 72% 76%, transparent 76%);
}
</style>
