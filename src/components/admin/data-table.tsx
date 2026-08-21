import * as React from 'react';

import { ErrorState } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

/**
 * The administration list table.
 *
 * A presentational primitive with no data fetching and no state, so it renders
 * inside a Server Component and the products and question-bank lists can stay
 * `async` pages that pass rows straight in.
 *
 * The important design decision is that it refuses to paper over the difference
 * between three outcomes:
 *
 *  - **rows** — render the table;
 *  - **an empty result** — render the caller's `empty` node, which is a required
 *    prop precisely so the caller has to decide between "nothing exists yet" and
 *    "nothing matches this filter". They need different words and different
 *    actions, and a component that defaulted one would erase the distinction;
 *  - **a failed query** — render `ErrorState`, never a table with no rows. A
 *    table drawn empty because a query threw reads as a true fact about the
 *    business, which is how somebody ends up believing there are no orders.
 *
 * `failed` matching the `failed?: boolean` prop on the student-area record lists
 * is deliberate: the same signal should look the same everywhere.
 */
export type DataTableColumn<Row> = {
  /** Stable identifier; also the React key for the header and each cell. */
  key: string;
  header: string;
  /**
   * Render the header for assistive technology only. For a column of buttons: it
   * has no useful visible label, but a header cell with no accessible name
   * leaves every control in that column unannounced when a screen reader walks
   * the table by column.
   */
  headerHidden?: boolean;
  /**
   * Marks the column that identifies the row, rendered as `<th scope="row">`.
   * At most one per table — it is what lets a screen reader announce "الحالة،
   * منشور" against the right subject instead of reading a bare cell.
   */
  isRowHeader?: boolean;
  /**
   * `ltr` for Latin content — slugs, ids, addresses. Isolating them keeps the
   * RTL layout stable: a cell starting with a digit or a hyphen otherwise
   * reorders around its neighbours.
   */
  dir?: 'ltr';
  align?: 'start' | 'end';
  className?: string;
  cell: (row: Row) => React.ReactNode;
};

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  failed = false,
  empty,
  className,
}: {
  /** Describes the table for a screen reader; never shown. */
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row, index: number) => string;
  /** True when the query threw. Renders `ErrorState` instead of a table. */
  failed?: boolean;
  /** Required: the caller decides which kind of emptiness this is. */
  empty: React.ReactNode;
  className?: string;
}) {
  if (failed) return <ErrorState />;
  if (rows.length === 0) return <>{empty}</>;

  return (
    /*
     * The scroll container is focusable and labelled. A table wider than its
     * column is otherwise reachable by pointer and by nothing else, which leaves
     * keyboard users unable to see the columns at the inline end.
     */
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cn(
        // `overflow-x-auto` clips to the rounded corners like the recipe's
        // `overflow-hidden` would, without disabling this region's scrolling.
        // `relative` makes this box the containing block for the `sr-only`
        // spans inside `headerHidden` cells: they are absolutely positioned, and
        // an unpositioned scroll ancestor does not clip absolute descendants —
        // they were escaping the region and dragging the page 113px wider.
        'rounded-card border-line-200 bg-surface shadow-card relative overflow-x-auto border',
        'focus-visible:outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>

        <thead>
          {/*
            `brand-50` rather than the grey `surface-muted`: the header band is
            the table's own chrome, and tinting it toward the brand keeps it a
            shade of the surface instead of a second, colder material.
          */}
          <tr className="border-line-200 bg-brand-50 border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'text-ink-600 px-[18px] py-3.5 text-start text-[12.5px] font-semibold whitespace-nowrap',
                  column.align === 'end' && 'text-end',
                  column.className,
                )}
              >
                {column.headerHidden ? (
                  <span className="sr-only">{column.header}</span>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-line-200 divide-y">
          {rows.map((row, index) => (
            <tr
              key={getRowKey(row, index)}
              className="hover:bg-brand-50/50 transition-colors duration-150"
            >
              {columns.map((column) => {
                const content = column.cell(row);
                const cellClasses = cn(
                  'text-ink-900 px-[18px] py-4 text-start align-middle leading-[1.6]',
                  column.align === 'end' && 'text-end',
                  column.className,
                );

                return column.isRowHeader ? (
                  <th
                    key={column.key}
                    scope="row"
                    dir={column.dir}
                    className={cn(cellClasses, 'font-medium')}
                  >
                    {content}
                  </th>
                ) : (
                  <td key={column.key} dir={column.dir} className={cellClasses}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
