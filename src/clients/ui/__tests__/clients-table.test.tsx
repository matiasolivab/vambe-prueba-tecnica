import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ClientsTable } from "@/clients/ui/clients-table";
import { makeClient } from "./make-client";

describe("ClientsTable", () => {
  it("renders one row per client with the name visible", () => {
    const clients = [
      makeClient({ id: "1", name: "Carla Pérez", email: "c.perez@example.com" }),
      makeClient({ id: "2", name: "Luis Soto", email: "l.soto@example.com" }),
      makeClient({ id: "3", name: "Mario Díaz", email: "m.diaz@example.com" }),
    ];
    render(<ClientsTable initialClients={clients} />);
    expect(screen.getByText("Carla Pérez")).toBeInTheDocument();
    expect(screen.getByText("Luis Soto")).toBeInTheDocument();
    expect(screen.getByText("Mario Díaz")).toBeInTheDocument();
  });

  it("renders the expected column headers", () => {
    render(<ClientsTable initialClients={[makeClient()]} />);
    for (const header of [
      "Cliente",
      "Vendedor",
      "Industria",
      "Tamaño",
      "Dolor",
      "Objeción",
      "Origen",
      "Estado",
      "Sentiment",
      "Status",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("columnheader", { name: "Rol decisor" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Señal" }),
    ).not.toBeInTheDocument();
  });

  it("shows a 'Fallo' badge on failed classification rows", () => {
    render(
      <ClientsTable
        initialClients={[
          makeClient({
            id: "f1",
            name: "Falla Row",
            classificationStatus: "failed",
            errorMessage: "LLM timeout",
          }),
        ]}
      />,
    );
    expect(screen.getByText(/fallo/i)).toBeInTheDocument();
  });

  it("shows a 'Truncado' badge on truncated rows", () => {
    render(
      <ClientsTable
        initialClients={[
          makeClient({ id: "t1", name: "Trunc Row", truncated: true }),
        ]}
      />,
    );
    expect(screen.getByText(/truncado/i)).toBeInTheDocument();
  });

  it("opens the detail modal when a row is clicked", async () => {
    const user = userEvent.setup();
    const clients = [
      makeClient({
        id: "x1",
        name: "Clic Target",
        email: "clic@example.com",
      }),
    ];
    render(<ClientsTable initialClients={clients} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByText("Clic Target"));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("renders 'Sin clientes' when initialClients is empty", () => {
    render(<ClientsTable initialClients={[]} />);
    expect(screen.getByText(/sin clientes/i)).toBeInTheDocument();
  });

  it("paginates: shows first `pageSize` clients and navigates to next page", async () => {
    const user = userEvent.setup();
    const clients = Array.from({ length: 5 }, (_, i) =>
      makeClient({
        id: `id-${i}`,
        name: `Cliente ${i + 1}`,
        email: `c${i + 1}@example.com`,
      }),
    );
    render(<ClientsTable initialClients={clients} pageSize={2} />);

    expect(screen.getByText("Cliente 1")).toBeInTheDocument();
    expect(screen.getByText("Cliente 2")).toBeInTheDocument();
    expect(screen.queryByText("Cliente 3")).not.toBeInTheDocument();
    expect(screen.getByText(/página 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByText(/mostrando 1–2 de 5/i)).toBeInTheDocument();

    const prev = screen.getByRole("button", { name: /página anterior/i });
    expect(prev).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /página siguiente/i }));
    expect(screen.getByText("Cliente 3")).toBeInTheDocument();
    expect(screen.getByText("Cliente 4")).toBeInTheDocument();
    expect(screen.queryByText("Cliente 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /página siguiente/i }));
    expect(screen.getByText("Cliente 5")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /página siguiente/i }),
    ).toBeDisabled();
  });
});
