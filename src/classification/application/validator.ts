import type { Classification } from "@/classification/domain/schema";

/**
 * Defense layer 6 (see `docs/ARCHITECTURE.md` §13 rule 6 + rule 12).
 *
 * Post-LLM consistency validation. The Zod schema (layer 1) guarantees every
 * field is structurally valid and inside its closed enum — but it cannot catch
 * SEMANTIC inconsistencies across fields.
 *
 * Implemented as a DECLARATIVE rule table (`INCONSISTENCY_RULES`) rather than
 * ad-hoc `if` blocks so adding a new rule is a one-line table entry — no touch
 * on the class (Open/Closed). The validator NEVER throws: per PRD RF2.5 +
 * ARCHITECTURE §13 layer 6, warnings are persisted and the pipeline continues.
 * Rejecting a row because of a warning would silently lose audit data.
 *
 * The returned `Warning[]` lands in the DB `warnings` jsonb column (task 2.1)
 * and later surfaces in the client-detail modal (task 7.4).
 *
 * v3.0.0: buyingSignal removed — the two cross-dim rules (signal_vs_sentiment,
 * frio_signal_with_positive_sentiment) are dropped. Table is empty until a new
 * cross-dim inconsistency is identified for leadSource or another dimension.
 */

export type Severity = "warning" | "error";

export interface Warning {
  readonly name: string;
  readonly severity: Severity;
  readonly message: string;
}

export interface InconsistencyRule {
  readonly name: string;
  readonly severity: Severity;
  readonly matches: (c: Classification) => boolean;
  readonly message: (c: Classification) => string;
}

/**
 * The canonical rule table. Add a new inconsistency check by appending an
 * entry here — do NOT modify `ClassificationValidator` itself.
 *
 * Rule names are stable identifiers (snake_case) used as discriminators in
 * logs, the DB `warnings` column, and the UI modal. Never rename a name
 * without a migration plan.
 */
export const INCONSISTENCY_RULES: readonly InconsistencyRule[] = [];

export class ClassificationValidator {
  public constructor(
    private readonly rules: readonly InconsistencyRule[] = INCONSISTENCY_RULES,
  ) {}

  public validate(c: Classification): readonly Warning[] {
    const warnings: Warning[] = [];
    for (const rule of this.rules) {
      if (rule.matches(c)) {
        warnings.push({
          name: rule.name,
          severity: rule.severity,
          message: rule.message(c),
        });
      }
    }
    return warnings;
  }
}
