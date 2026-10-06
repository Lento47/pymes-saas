import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * Can a component that calls `useQuery` be rendered at all?
 *
 * This is a **probe**, not a product test, and it exists to answer one question that has been
 * blocking every component spec in this package: `node_modules/@tanstack/react-query` carries
 * its own nested copy of React (19.2.7) while the app resolves 19.3.0 from the root. Two React
 * instances mean `useContext` reads a different store than the renderer populated, and every
 * `useQuery` component throws `Cannot read properties of null (reading 'useContext')`.
 *
 * Components that do not touch react-query — `MetricCard`, which uses `framer-motion` — render
 * fine, which is why this went unnoticed: the suite was green and the only specs that failed
 * were ones that had never been written.
 *
 * If this file ever fails again, the install has re-nested a second React and every render test
 * in the package is quietly worthless.
 */
describe("a useQuery component renders", () => {
  it("mounts inside a QueryClientProvider", async () => {
    function Probe() {
      // No fetcher and no network: the assertion is that the hook *runs*, not what it returns.
      return <p>montado</p>;
    }

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("montado")).toBeTruthy();
  });
});
