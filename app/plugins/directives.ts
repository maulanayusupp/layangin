import { vCssVars } from '~/directives/cssVars'

/**
 * Registers global directives. Runs on both server and client so `v-css-vars`
 * can contribute its SSR props during prerender.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('css-vars', vCssVars)
})
