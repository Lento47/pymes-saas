import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/arc/input/input";
import { Select } from "@/components/arc/select/select";
import { Textarea } from "@/components/arc/textarea/textarea";

/**
 * `hideLabel`, which is the prop that unblocked this component's adoption.
 *
 * The problem it solves: upstream renders `label` in an unconditional `<label>`, so a search box
 * in a filter toolbar ends up saying "Buscar por comercio" twice — once as a placeholder and once
 * above the field — and every one of those sites was kept on a second input component for the
 * sake of one line.
 *
 * The failure this guards is not the obvious one. A naive fix would drop the label element, which
 * typechecks, builds and renders a control with **no accessible name at all** — and a filter
 * toolbar full of unlabelled comboboxes is exactly the regression the console's own sort control
 * was protected from carrying `aria-label` by hand.
 *
 * So both halves are asserted: the label element is still there and still associated by `htmlFor`,
 * and it is the `srOnly` class rather than nothing. The class name is checked by *presence* and
 * not by value, because Vitest does not resolve CSS-module keys — asserting `styles.srOnly` would
 * find nothing and pass for the wrong reason.
 */
describe("hideLabel", () => {
  it("keeps a real, associated label for the input", () => {
    const { container } = render(<Input hideLabel label="Buscar negocios" />);
    const input = screen.getByLabelText("Buscar negocios");

    expect(input).toBeInTheDocument();
    const label = container.querySelector("label");
    expect(label).not.toBeNull();
    expect(label?.getAttribute("for")).toBe(input.id);
    // Not `undefined` either: an unclassed label is the visible one this prop exists to replace.
    expect(label?.className).toBeTruthy();
  });

  it("keeps a real, associated label for the textarea", () => {
    const { container } = render(
      <Textarea hideLabel label="Escribe tu respuesta" />,
    );
    const textarea = screen.getByLabelText("Escribe tu respuesta");

    expect(textarea).toBeInTheDocument();
    expect(container.querySelector("label")?.getAttribute("for")).toBe(
      textarea.id,
    );
  });

  it("keeps a real, associated label for the select", () => {
    const { container } = render(
      <Select
        hideLabel
        label="Ordenar por"
        value="arrears"
        onValueChange={() => {}}
        options={[
          { value: "arrears", label: "Deuda" },
          { value: "name", label: "Nombre" },
        ]}
      />,
    );

    const trigger = screen.getByRole("combobox");
    expect(container.querySelector("label")?.getAttribute("for")).toBe(
      trigger.id,
    );
    // The label text is in the accessibility tree even though it is not painted.
    expect(container.textContent).toContain("Ordenar por");
  });

  it("leaves the visible label alone when the prop is absent", () => {
    const { container } = render(<Input label="Monto recibido" />);
    const label = container.querySelector("label");

    expect(label?.className).toBeTruthy();
    // `hideLabel` and its visible counterpart are different classes, and only the hidden one
    // carries the clip. Comparing them is what proves the prop is doing the work.
    expect(label?.className).not.toBe(
      render(<Input hideLabel label="x" />).container.querySelector("label")
        ?.className,
    );
  });
});
