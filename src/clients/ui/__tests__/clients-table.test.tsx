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
      "Rol decisor",
      "Estado",
      "Sentiment",
      "Señal",
      "Status",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }
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

    // modal not open initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByText("Clic Target"));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("renders 'Sin clientes' when initialClients is empty", () => {
    render(<ClientsTable initialClients={[]} />);
    expect(screen.getByText(/sin clientes/i)).toBeInTheDocument();
  });
});
