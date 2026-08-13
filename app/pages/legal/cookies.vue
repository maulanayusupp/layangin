<script setup lang="ts">
import { COOKIES_UPDATED } from '~~/shared/constants/legal'

/**
 * Cookie page.
 *
 * The table lists all three storage entries the site creates, and labels which
 * are cookies and which are `localStorage` — a distinction most cookie pages blur
 * even though only one of the two is ever sent to a server. The names match the
 * constants in `services/persistence/schema.ts` and the i18n cookie key in
 * `nuxt.config.ts`; changing either means changing this table.
 */
const { t } = useI18n()

const rows = ['locale', 'save', 'settings'] as const

usePageSeo(() => ({
  title: t('legal.cookies.meta.title'),
  description: t('legal.cookies.meta.description'),
}))
</script>

<template>
  <LayoutLegalPage
    :eyebrow="t('legal.cookies.header.eyebrow')"
    :title="t('legal.cookies.header.title')"
    :lead="t('legal.cookies.header.lead')"
    :updated="COOKIES_UPDATED"
  >
    <h2>{{ t('legal.cookies.sections.why.title') }}</h2>
    <p>{{ t('legal.cookies.sections.why.body') }}</p>

    <h2>{{ t('legal.cookies.sections.table.title') }}</h2>

    <div class="u-scroll-x">
      <table class="cookies__table">
        <thead>
          <tr>
            <th scope="col">
              {{ t('legal.cookies.sections.table.name') }}
            </th>
            <th scope="col">
              {{ t('legal.cookies.sections.table.purpose') }}
            </th>
            <th scope="col">
              {{ t('legal.cookies.sections.table.duration') }}
            </th>
            <th scope="col">
              {{ t('legal.cookies.sections.table.type') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row"
          >
            <th scope="row">
              <code>{{ t(`legal.cookies.sections.table.rows.${row}.name`) }}</code>
            </th>
            <td>{{ t(`legal.cookies.sections.table.rows.${row}.purpose`) }}</td>
            <td>{{ t(`legal.cookies.sections.table.rows.${row}.duration`) }}</td>
            <td>{{ t(`legal.cookies.sections.table.rows.${row}.type`) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2>{{ t('legal.cookies.sections.control.title') }}</h2>
    <p>{{ t('legal.cookies.sections.control.body') }}</p>
  </LayoutLegalPage>
</template>

<style scoped lang="scss">
.cookies__table {
  min-width: rem(680);
  font-size: var(--fs-sm);

  th,
  td {
    padding: var(--sp-3);
    text-align: start;
    vertical-align: top;
    border-block-end: 1px solid var(--c-hairline);
  }

  thead th {
    font-family: var(--font-mono);
    font-size: rem(10);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-text-mute);
  }

  tbody th {
    white-space: nowrap;
  }

  tbody td {
    color: var(--c-text-soft);
  }
}
</style>
