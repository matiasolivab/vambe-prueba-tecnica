/**
 * Classifier version — bumped whenever the prompt, Zod schema, or
 * post-validator changes meaningfully (see `docs/ARCHITECTURE.md` §13
 * rule 13). Persisted on every classification row so runs executed with
 * different classifier logic remain distinguishable in the DB.
 */
export const CLASSIFIER_VERSION = "2.0.0" as const;
