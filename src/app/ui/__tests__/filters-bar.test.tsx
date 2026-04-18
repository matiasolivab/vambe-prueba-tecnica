import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FiltersBar } from "@/app/ui/filters/filters-bar";

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
  it("renders only the trigger when no filters are active", () => {
    render(<FiltersBar sellers={SELLERS} />);

    expect(screen.getByRole("button", { name: /filtros/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/vendedor/i)).not.toBeInTheDocument();
  });

  it("shows a count badge on the trigger when filters are active", () => {
    currentSp = "vendor=Toro&closed=true";
    render(<FiltersBar sellers={SELLERS} />);

    expect(screen.getByRole("button", { name: /filtros/i })).toHaveTextContent(
      "2",
    );
  });

  it("opening the popover surfaces the 5 selects, search, and Limpiar todo", async () => {
    const user = userEvent.setup();
    render(<FiltersBar sellers={SELLERS} />);

    await user.click(screen.getByRole("button", { name: /filtros/i }));

    expect(await screen.findByLabelText(/vendedor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/industria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tamaño/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sentiment/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nombre o email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /limpiar todo/i }),
    ).toBeInTheDocument();
  });

  it("changing the Vendedor Select pushes the new `vendor` param to the URL", async () => {
    const user = userEvent.setup();
    render(<FiltersBar sellers={SELLERS} />);

    await user.click(screen.getByRole("button", { name: /filtros/i }));
    await user.click(await screen.findByLabelText(/vendedor/i));
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

    await user.click(screen.getByRole("button", { name: /filtros/i }));
    await user.click(await screen.findByLabelText(/vendedor/i));
    const todosOption = await screen.findByRole("option", { name: /todos/i });
    await user.click(todosOption);

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    const lastCall = pushMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("/?industry=Tecnolog%C3%ADa");
    expect(lastCall?.[0]).not.toMatch(/vendor/);
  });

  it("debounces search input 400ms before pushing ?search=<text>", async () => {
    const user = userEvent.setup();
    render(<FiltersBar sellers={SELLERS} />);
    await user.click(screen.getByRole("button", { name: /filtros/i }));
    const input = await screen.findByPlaceholderText(/nombre o email/i);

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.change(input, { target: { value: "juan" } });
    });

    expect(pushMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0]?.[0]).toBe("/?search=juan");
  });

  it('"Limpiar todo" clears every query param (pushes to pathname only)', async () => {
    currentSp = "vendor=Toro&closed=true&search=x";
    const user = userEvent.setup();
    render(<FiltersBar sellers={SELLERS} />);

    await user.click(screen.getByRole("button", { name: /filtros/i }));
    await user.click(
      await screen.findByRole("button", { name: /limpiar todo/i }),
    );

    expect(pushMock).toHaveBeenCalledWith("/", { scroll: false });
  });

});
