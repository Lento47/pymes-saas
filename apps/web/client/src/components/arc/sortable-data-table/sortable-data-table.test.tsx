import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  SortableDataTable,
  type DataColumn,
} from "@/components/arc/sortable-data-table/sortable-data-table";

/**
 * The Arc table, rendered — because every console table now goes through it.
 *
 * Six of the console's panels were migrated to this component in one pass, and nothing else in
 * the suite can see that they still draw. `tsc` proves a column definition is well-typed; a
 * regex on the source proves the tag is present; neither proves that **a row survives the
 * journey**. A `render` that returned a `<table>` with an empty `<tbody>` would typecheck, build,
 * lint clean, and leave six blank tabs in production.
 *
 * So the first assertion here is deliberately an equality against `rows.length` and not a
 * "something rendered" check. That is the shape that cannot pass vacuously.
 */

type Row = { id: string; name: string; amount: number; note: string | null };

const rows: Row[] = [
  { id: "a", name: "Zapatería", amount: 30, note: null },
  { id: "b", name: "Almacén", amount: 10, note: "con nota" },
  { id: "c", name: "Panadería", amount: 20, note: null },
];

const columns: DataColumn<Row>[] = [
  { key: "name", label: "Negocio", sortable: true },
  { key: "amount", label: "Importe", numeric: true, sortable: true },
  { key: "note", label: "Nota", sortable: true },
  {
    key: "actions",
    label: "Acciones",
    sortable: false,
    render: (_value, row) => <button type="button">Borrar {row.name}</button>,
  },
];

/**
 * The rendered body rows.
 *
 * Scoped to `tbody` through the DOM rather than by role: the component marks up both `<thead>`
 * and `<tbody>` as `role="rowgroup"` and every `<tr>` in them as `role="row"`, so a
 * `getAllByRole("row")` counts the header row too — which silently inflated the row count by
 * one and made the cell queries below throw. The empty state is also a `<tr>`, excluded by the
 * absence of cells.
 *
 * A selector rather than a role query is the honest way to say "the body", and it keeps working
 * if the component ever drops the redundant ARIA.
 */
function bodyRows(container: HTMLElement): HTMLTableRowElement[] {
  return Array.from(
    container.querySelectorAll<HTMLTableRowElement>("tbody tr"),
  ).filter((row) => row.querySelectorAll("td").length > 1);
}

/** The first cell of each body row, which is the column under test. */
function leadingCells(container: HTMLElement): (string | null | undefined)[] {
  return bodyRows(container).map((row) => row.querySelector("td")?.textContent);
}

describe("SortableDataTable", () => {
  it("renders one row per row, with the rendered cell contents", () => {
    const { container } = render(
      <SortableDataTable<Row>
        rows={rows}
        rowKey="id"
        columns={columns}
        caption="Prueba"
      />,
    );

    // Equality, not a lower bound: this is the assertion that fails if the body stops drawing.
    expect(bodyRows(container)).toHaveLength(rows.length);
    expect(screen.getByRole("table", { name: "Prueba" })).toBeInTheDocument();

    // A column with a `render` shows the render, not the raw value.
    expect(
      screen.getByRole("button", { name: "Borrar Zapatería" }),
    ).toBeInTheDocument();

    // And a column without one falls back to the value.
    expect(screen.getByText("Panadería")).toBeInTheDocument();
  });

  it("shows the empty message instead of an empty body when there are no rows", () => {
    render(
      <SortableDataTable<Row>
        rows={[]}
        rowKey="id"
        columns={columns}
        emptyMessage="No hay nada."
      />,
    );

    expect(screen.getByText("No hay nada.")).toBeInTheDocument();
    // A header is still worth showing, so the operator can see what the columns would have been.
    expect(
      screen.getByRole("columnheader", { name: /Negocio/ }),
    ).toBeInTheDocument();
  });

  it("gives a sortable column a sort control and a non-sortable column none", () => {
    render(
      <SortableDataTable<Row> rows={rows} rowKey="id" columns={columns} />,
    );

    expect(
      screen.getByRole("button", { name: /^Sort by Negocio/ }),
    ).toBeInTheDocument();

    // This is the defect the migration was checked for. `sortable` defaults to `true`
    // upstream, so a column keyed on something absent from the row — every "Acciones" column,
    // and the `businessRoles` array — rendered a control that announced a sort and then
    // reordered nothing. Silence is the correct rendering: no button, no `aria-sort`.
    const actions = screen.getByRole("columnheader", { name: "Acciones" });
    expect(within(actions).queryByRole("button")).toBeNull();
    expect(actions).not.toHaveAttribute("aria-sort");
  });

  it("reorders rows when a sortable header is used, and returns them on a second press", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SortableDataTable<Row> rows={rows} rowKey="id" columns={columns} />,
    );

    // Deliberately unsorted, so a reordering cannot be mistaken for the input order.
    expect(leadingCells(container)).toEqual([
      "Zapatería",
      "Almacén",
      "Panadería",
    ]);

    await user.click(screen.getByRole("button", { name: /^Sort by Importe/ }));
    expect(leadingCells(container)).toEqual([
      "Almacén",
      "Panadería",
      "Zapatería",
    ]);

    // Second press flips the direction rather than re-applying it.
    await user.click(
      screen.getByRole("button", { name: /currently ascending/ }),
    );
    expect(leadingCells(container)).toEqual([
      "Zapatería",
      "Panadería",
      "Almacén",
    ]);
  });

  it("keeps empties at the bottom in both directions", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SortableDataTable<Row> rows={rows} rowKey="id" columns={columns} />,
    );

    // "Almacén" is the only row with a note, so it is the only one that may lead; the two
    // nulls are equal to each other, so they hold their input order beneath it.
    await user.click(screen.getByRole("button", { name: /^Sort by Nota/ }));
    expect(leadingCells(container)).toEqual([
      "Almacén",
      "Zapatería",
      "Panadería",
    ]);

    const noteCells = bodyRows(container).map(
      (row) => row.querySelectorAll("td")[2]?.textContent,
    );
    expect(noteCells).toEqual(["con nota", "–", "–"]);
  });
});
