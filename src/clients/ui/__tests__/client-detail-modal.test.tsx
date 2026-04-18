import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClientDetailModal } from "@/clients/ui/client-detail-modal";
import { makeClient } from "./make-client";

describe("ClientDetailModal", () => {
  it("does not render dialog content when client is null", () => {
    render(<ClientDetailModal client={null} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title with client name and shows email when client provided", () => {
    const c = makeClient({
      name: "Carla Pérez",
      email: "c.perez@example.com",
    });
    render(<ClientDetailModal client={c} onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Carla Pérez")).toBeInTheDocument();
    expect(screen.getByText(/c\.perez@example\.com/i)).toBeInTheDocument();
  });

  it("renders needsSummary, nextSteps, and transcript content", () => {
    const c = makeClient({
      needsSummary: "NEEDS_SUMMARY_MARKER",
      nextSteps: "NEXT_STEPS_MARKER",
      transcript: "TRANSCRIPT_MARKER line one\nline two",
    });
    render(<ClientDetailModal client={c} onClose={() => {}} />);
    expect(screen.getByText(/NEEDS_SUMMARY_MARKER/)).toBeInTheDocument();
    expect(screen.getByText(/NEXT_STEPS_MARKER/)).toBeInTheDocument();
    expect(screen.getByText(/TRANSCRIPT_MARKER/)).toBeInTheDocument();
  });

  it("shows warnings count badge when warnings array is non-empty", () => {
    const c = makeClient({
      warnings: [
        { name: "MISSING_FIELD", severity: "warn", message: "x" },
        { name: "DOUBT", severity: "info", message: "y" },
      ],
    });
    render(<ClientDetailModal client={c} onClose={() => {}} />);
    expect(screen.getByText(/2\s*(advertencia|warning)/i)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ClientDetailModal client={makeClient()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
