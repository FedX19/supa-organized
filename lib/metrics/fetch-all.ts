import { SupabaseClient } from '@supabase/supabase-js'

/**
 * PostgREST caps a plain `.select()` at 1000 rows (Supabase's default
 * `max-rows`). The existing analytics code selects `user_activity` unbounded —
 * that table is already at 932 rows on production, so it is days away from
 * silently truncating and quietly under-reporting every metric built on it.
 *
 * This pages through with explicit ranges until a short page comes back.
 */
const PAGE_SIZE = 1000
const MAX_PAGES = 100 // hard ceiling: 100k rows, then we stop and report

export interface FetchAllOptions {
  /** Columns to select. Defaults to '*'. */
  columns?: string
  /** Applied to every page before ranging. */
  filter?: (query: any) => any
  /** Stable ordering column — required for correct paging. */
  orderBy?: string
  ascending?: boolean
}

export interface FetchAllResult<T> {
  rows: T[]
  /** True when MAX_PAGES was hit and there may be more data. */
  truncated: boolean
  /** Set when the table is missing or unreadable, rather than throwing. */
  error?: string
}

export async function fetchAll<T = Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  options: FetchAllOptions = {}
): Promise<FetchAllResult<T>> {
  const { columns = '*', filter, orderBy, ascending = true } = options
  const rows: T[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    let query = client.from(table).select(columns)
    if (filter) query = filter(query)
    // Stable ordering is required or paging can repeat/skip rows.
    query = orderBy ? query.order(orderBy, { ascending }) : query.order('id', { ascending: true })
    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data, error } = await query

    if (error) {
      // Missing table is an expected condition (not every customer DB has
      // user_activity), so report it rather than throwing.
      return { rows, truncated: false, error: error.message }
    }
    if (!data || data.length === 0) return { rows, truncated: false }

    rows.push(...(data as T[]))
    if (data.length < PAGE_SIZE) return { rows, truncated: false }
  }

  return { rows, truncated: true }
}
