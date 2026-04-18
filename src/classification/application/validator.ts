import type { Classification } from "@/classification/domain/schema";

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
