import type { Client } from "@/clients/infrastructure/db/schema";

export function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Cliente Ejemplo",
    email: "cliente@example.com",
    phone: "+56 9 1234 5678",
    meetingDate: new Date("2025-10-15T10:00:00Z"),
    assignedSeller: "Ana",
    closed: false,
    transcript: "V: Hola… C: Nos interesa, pero el precio es alto.",
    industry: "Tecnología",
    companySize: "Mediana",
    mainPainPoint: "Costo",
    keyObjection: "Precio",
    leadSource: "No Mencionado",
    sentiment: "Neutro",
    needsSummary: "Busca reducir costos operativos.",
    nextSteps: "Agendar demo técnica con el CTO.",
    reasoning: "Señales mixtas: interés pero fricción por precio.",
    promptVersion: "3.0.0",
    modelVersion: "gpt-4o-mini-2024-07-18",
    truncated: false,
    classificationStatus: "ok",
    errorMessage: null,
    warnings: [],
    createdAt: new Date("2025-10-15T10:05:00Z"),
    updatedAt: new Date("2025-10-15T10:05:00Z"),
    ...overrides,
  };
}
