import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FiltersBar } from "@/app/ui/filters-bar";

/**
 * FiltersBar — URL-driven global filter strip (PRD §RF3.2). Contract:
 *   - Select changes → `router.push('/?key=value', { scroll: false })`.
 *   - Selecting "Todos"/"Todas" → key removed from URL.
 *   - Search input → debounced 400ms, pushes `search=<text>`.
 *   - "Limpiar" → `router.push('/')` (no params).
 *
 * The router is mocked so we can assert URL pushes without a real
 * navigation. `useSearchParams()` returns a fresh `URLSearchParams` each
 * render so consecutive tests don't leak state through the closure.
 */

const pushMock = vi.fn();
let currentSp = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(currentSp),
}));

const SELLERS = ["Alma", "Toro", "Vera"] as const;

beforeEach(() => {
  pushMock.mockReset();
  currentSp = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FiltersBar", () => {
  it("renders all 5 Select triggers, the search input, and the Limpiar button", () => {
    render(<FiltersBar sellers={SELLERS} />);

    // Five Select triggers (identified by their aria-label).
    expect(screen.getByLabelText(/vendedor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/industria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tamaño/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sentiment/i)).toBeInTheDocument();

    // Search input + Limpiar button.
    expect(
      screen.getByPlaceholderText(/nombre o email/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /limpiar/i }),
    ).toBeInTheDocument();
  });

  it("changing the Vendedor Select pushes the new `vendor` param to the URL", async () => {
    const user = userEvent.setup();
    render(<FiltersBar sellers={SELLERS} />);

    await user.click(screen.getByLabelText(/vendedor/i));
    const option = await screen.findByRole("option", { name: "Toro" });
    await user.click(option);

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    const lastCall = pushMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("/?vendor=Toro");
    expect(lastCall?.[1]).toEqual({ scroll: false });
  });

  it('selecting "Todos" on a populated filter removes that key from the URL', async () => {
    currentSp = "vendor=Toro&industry=Tecnología";
    const user = userEvent.setup();
    render(<FiltersBar sellers={SELLERS} />);

    await user.click(screen.getByLabelText(/vendedor/i));
    const todosOption = await screen.findByRole("option", { name: /todos/i });
    await user.click(todosOption);

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    const lastCall = pushMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("/?industry=Tecnolog%C3%ADa");
    // The `vendor` param must be gone; `industry` must survive.
    expect(lastCall?.[0]).not.toMatch(/vendor/);
  });

  it("debounces search input 400ms before pushing ?search=<text>", async () => {
    // Use fake timers + direct fireEvent to avoid user-event's own async
    // scheduling clashing with vi's fake clock.
    vi.useFakeTimers();
    render(<FiltersBar sellers={SELLERS} />);

    const input = screen.getByPlaceholderText(/nombre o email/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "juan" } });
    });

    // Before 400ms elapses, no push.
    expect(pushMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0]?.[0]).toBe("/?search=juan");
  });

  it('"Limpiar" clears every query param (pushes to pathname only)', async () => {
    currentSp = "vendor=Toro&closed=true&search=x";
    const user = userEvent.setup();
    render(<FiltersBar sellers={SELLERS} />);

    await user.click(screen.getByRole("button", { name: /limpiar/i }));

    expect(pushMock).toHaveBeenCalledWith("/", { scroll: false });
  });
});
