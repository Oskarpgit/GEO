import { z } from "zod";
import type { Ruleset } from "../domain/types.js";

const severitySchema = z.enum(["blocker", "error", "warning", "guidance"]);

const sourceSchema = z.object({
  sourceId: z.string().min(1),
  url: z.url().startsWith("https://"),
  title: z.string().min(1),
});

const ruleSchema = z.object({
  ruleId: z.string().regex(/^ALG-[A-Z]+-\d{3}$/u),
  field: z.string().min(1),
  severity: severitySchema,
  kind: z.string().min(1),
  assertion: z.record(z.string(), z.unknown()),
  messagePl: z.string().min(1),
  sourceId: z.string().min(1),
  autofix: z.boolean(),
});

const rulesetSchema = z.object({
  rulesetId: z.string().min(1),
  marketplace: z.literal("allegro-pl"),
  retrievedAt: z.iso.datetime({ offset: true }),
  sources: z.array(sourceSchema).min(1),
  rules: z.array(ruleSchema).min(1),
});

export function parseRuleset(input: unknown): Ruleset {
  const parsed = rulesetSchema.parse(input) as Ruleset;
  const sourceIds = new Set(parsed.sources.map((source) => source.sourceId));
  const ruleIds = new Set<string>();

  for (const rule of parsed.rules) {
    if (!sourceIds.has(rule.sourceId)) {
      throw new Error(`Reguła ${rule.ruleId} wskazuje nieistniejące źródło ${rule.sourceId}.`);
    }
    if (ruleIds.has(rule.ruleId)) {
      throw new Error(`Zduplikowany identyfikator reguły: ${rule.ruleId}.`);
    }
    ruleIds.add(rule.ruleId);
  }

  return parsed;
}

