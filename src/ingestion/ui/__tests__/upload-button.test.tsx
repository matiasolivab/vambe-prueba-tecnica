import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UploadButton from "@/ingestion/ui/upload-button";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

function streamResponse(text: string, init?: ResponseInit): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(stream, init);
}

function makeCsvFile(): File {
  return new File(["email,transcript\na@b.com,hi"], "clients.csv", {
    type: "text/csv",
  });
}

async function uploadFileViaInput(
  file: File,
  opts: { password?: string } = {},
): Promise<void> {
  const password = opts.password ?? "pruebavambe123";
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /subir csv nuevo/i }));
  const passwordInput = await screen.findByTestId("upload-password");
  await user.type(passwordInput, password);
  await user.click(screen.getByRole("button", { name: /continuar/i }));
  const input = await screen.findByTestId("upload-input");
  await user.upload(input, file);
}

beforeEach(() => {
  refreshMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UploadButton", () => {
  it("renders the trigger button with the expected label", () => {
    render(<UploadButton />);
    expect(
      screen.getByRole("button", { name: /subir csv nuevo/i }),
    ).toBeInTheDocument();
  });

  it("opens the dialog on click and shows the password gate", async () => {
    const user = userEvent.setup();
    render(<UploadButton />);
    await user.click(screen.getByRole("button", { name: /subir csv nuevo/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByTestId("upload-password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continuar/i }),
    ).toBeInTheDocument();
  });

  it("shows 'Contraseña incorrecta' when the gate password is wrong", async () => {
    const user = userEvent.setup();
    render(<UploadButton />);
    await user.click(screen.getByRole("button", { name: /subir csv nuevo/i }));
    const passwordInput = await screen.findByTestId("upload-password");
    await user.type(passwordInput, "nope");
    await user.click(screen.getByRole("button", { name: /continuar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /contraseña incorrecta/i,
    );
    expect(
      screen.queryByText(/arrastr.*csv.*click.*seleccionar/i),
    ).not.toBeInTheDocument();
  });

  it("passes the gate with the correct password and reveals the dropzone", async () => {
    const user = userEvent.setup();
    render(<UploadButton />);
    await user.click(screen.getByRole("button", { name: /subir csv nuevo/i }));
    const passwordInput = await screen.findByTestId("upload-password");
    await user.type(passwordInput, "pruebavambe123");
    await user.click(screen.getByRole("button", { name: /continuar/i }));
    expect(
      await screen.findByText(/arrastr.*csv.*click.*seleccionar/i),
    ).toBeInTheDocument();
    const input = await screen.findByTestId("upload-input");
    expect(input).toHaveAttribute("accept", expect.stringContaining(".csv"));
  });

  it("runs happy path: progress + done → success message and router.refresh", async () => {
    const body =
      "event: progress\ndata: {\"total\":1,\"processed\":0,\"succeeded\":0,\"failed\":0}\n\n" +
      "event: progress\ndata: {\"total\":1,\"processed\":1,\"succeeded\":1,\"failed\":0,\"lastEmail\":\"a@b.com\"}\n\n" +
      "event: done\ndata: {\"total\":1,\"succeeded\":1,\"failed\":0,\"parseErrors\":[],\"classificationErrors\":[]}\n\n";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamResponse(body));

    render(<UploadButton />);
    await uploadFileViaInput(makeCsvFile());

    await waitFor(() =>
      expect(screen.getByText(/se clasificaron 1 clientes/i)).toBeInTheDocument(),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/upload",
      expect.objectContaining({ method: "POST" }),
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("renders error state with missing columns on error event", async () => {
    const body =
      "event: error\ndata: " +
      JSON.stringify({
        code: "ingestion.invalid_csv_format",
        message: "CSV inválido — faltan columnas: email",
        missingColumns: ["email"],
        unexpectedColumns: [],
      }) +
      "\n\n";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse(body));

    render(<UploadButton />);
    await uploadFileViaInput(makeCsvFile());

    await waitFor(() =>
      expect(screen.getByText(/csv inválido/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/^faltan columnas:?$/i)).toBeInTheDocument();
    const chips = screen.getAllByText(/^email$/i);
    expect(chips.length).toBeGreaterThan(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders network error state when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONN"));

    render(<UploadButton />);
    await uploadFileViaInput(makeCsvFile());

    await waitFor(() =>
      expect(screen.getByText(/no se pudo conectar/i)).toBeInTheDocument(),
    );
  });
});
