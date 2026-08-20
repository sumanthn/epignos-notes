import { z } from "zod";

export const bookConceptKindSchema = z.enum([
  "idea",
  "person",
  "organization",
  "place",
  "work",
  "event",
]);

export const bookConceptRelationKindSchema = z.enum([
  "related_to",
  "supports",
  "contrasts_with",
  "influences",
  "part_of",
  "precedes",
]);

const bookConceptSchema = z.object({
  key: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(90),
  kind: bookConceptKindSchema,
  description: z.string().trim().min(1).max(360),
  sourceNoteIds: z.array(z.string().trim().min(1)).min(1).max(12),
});

const bookConceptRelationSchema = z.object({
  fromKey: z.string().trim().min(1).max(32),
  toKey: z.string().trim().min(1).max(32),
  kind: bookConceptRelationKindSchema,
  description: z.string().trim().min(1).max(240),
  sourceNoteIds: z.array(z.string().trim().min(1)).min(1).max(12),
});

const bookConceptMapSchema = z.object({
  overview: z.string().trim().min(1).max(500),
  concepts: z.array(bookConceptSchema).min(1).max(18),
  relations: z.array(bookConceptRelationSchema).max(24),
});

export type BookConceptMapValue = z.infer<typeof bookConceptMapSchema>;
export type BookConceptKind = z.infer<typeof bookConceptKindSchema>;
export type BookConceptRelationKind = z.infer<typeof bookConceptRelationKindSchema>;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function validatedBookConceptMap(
  value: unknown,
  allowedSourceNoteIds: ReadonlySet<string>,
): BookConceptMapValue {
  const map = bookConceptMapSchema.parse(value);
  const conceptsByKey = new Map<string, (typeof map.concepts)[number]>();
  const names = new Set<string>();

  for (const concept of map.concepts) {
    const key = normalized(concept.key);
    const name = normalized(concept.name);
    if (conceptsByKey.has(key)) {
      throw new Error("The generated concept map contained duplicate concept keys.");
    }
    if (names.has(name)) {
      throw new Error("The generated concept map contained duplicate concept names.");
    }
    concept.sourceNoteIds = Array.from(new Set(concept.sourceNoteIds));
    if (concept.sourceNoteIds.some((noteId) => !allowedSourceNoteIds.has(noteId))) {
      throw new Error("A generated concept cited a note outside this book.");
    }
    conceptsByKey.set(key, concept);
    names.add(name);
  }

  const relationKeys = new Set<string>();
  for (const relation of map.relations) {
    const fromKey = normalized(relation.fromKey);
    const toKey = normalized(relation.toKey);
    const fromConcept = conceptsByKey.get(fromKey);
    const toConcept = conceptsByKey.get(toKey);
    if (!fromConcept || !toConcept) {
      throw new Error("A generated relationship referenced an unknown concept.");
    }
    if (fromKey === toKey) {
      throw new Error("A generated concept cannot relate to itself.");
    }

    relation.sourceNoteIds = Array.from(new Set(relation.sourceNoteIds));
    if (relation.sourceNoteIds.some((noteId) => !allowedSourceNoteIds.has(noteId))) {
      throw new Error("A generated relationship cited a note outside this book.");
    }
    const sharedSources = new Set(
      fromConcept.sourceNoteIds.filter((noteId) => toConcept.sourceNoteIds.includes(noteId)),
    );
    if (relation.sourceNoteIds.some((noteId) => !sharedSources.has(noteId))) {
      throw new Error("A generated relationship did not cite shared concept evidence.");
    }

    const symmetric = relation.kind === "related_to" || relation.kind === "contrasts_with";
    const endpoints = symmetric ? [fromKey, toKey].sort() : [fromKey, toKey];
    const relationKey = `${endpoints[0]}:${relation.kind}:${endpoints[1]}`;
    if (relationKeys.has(relationKey)) {
      throw new Error("The generated concept map contained a duplicate relationship.");
    }
    relationKeys.add(relationKey);
  }

  return map;
}

