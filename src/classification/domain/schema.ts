import { z } from "zod";

export const INDUSTRIES = [
  "Servicios Financieros",
  "E-commerce",
  "Consultoría",
  "Salud",
  "Educación",
  "Logística",
  "Servicios Profesionales",
  "Tecnología",
  "Eventos",
  "Real Estate",
  "Medios/Artes",
  "Hogar/Sostenibilidad",
  "Otros",
] as const;

export const COMPANY_SIZES = [
  "Startup",
  "PYME",
  "Mid-market",
  "Enterprise",
] as const;

export const MAIN_PAIN_POINTS = [
  "Volumen Repetitivo",
  "Equipo Saturado",
  "Respuestas Lentas",
  "Pérdida de Personalización",
  "Integración Técnica",
  "Consultas Especializadas",
  "Variabilidad Estacional",
] as const;

export const KEY_OBJECTIONS = [
  "Especificidad Técnica",
  "Integración",
  "Desconfianza Automatización",
  "Timing Bajo",
  "Compliance",
  "Ninguna",
] as const;

export const LEAD_SOURCES = [
  "Búsqueda Online",
  "Recomendación",
  "Publicidad",
  "Outbound",
  "Otros",
  "No Mencionado",
] as const;

export const SENTIMENTS = ["Positivo", "Neutro", "Negativo"] as const;

export const ClassificationSchema = z
  .object({
    reasoning: z.string().min(1),
    industry: z.enum(INDUSTRIES),
    companySize: z.enum(COMPANY_SIZES),
    mainPainPoint: z.enum(MAIN_PAIN_POINTS),
    keyObjection: z.enum(KEY_OBJECTIONS),
    leadSource: z.enum(LEAD_SOURCES),
    sentiment: z.enum(SENTIMENTS),
    needsSummary: z.string().min(20).max(600),
    nextSteps: z.string().min(10).max(450),
  })
  .strict();

export type Classification = z.infer<typeof ClassificationSchema>;
