import { z } from "zod";

const cardPointSchema = z.object({
  text: z.string().trim().min(1).max(280),
  sourceNoteIds: z.array(z.string().trim().min(1)).min(1).max(8),
});

const summaryCardSchema = z.object({
  title: z.string().trim().min(1).max(90),
  kind: z.enum(["overview", "concept", "person", "timeline", "comparison", "argument", "event"]),
  summary: z.string().trim().min(1).max(320),
  points: z.array(cardPointSchema).min(1).max(4),
});

const bookCardDeckSchema = z.object({
  overview: z.string().trim().min(1).max(500),
  cards: z.array(summaryCardSchema).min(2).max(8),
});

export type BookCardDeckValue = z.infer<typeof bookCardDeckSchema>;

export function validatedBookCardDeck(
  value: unknown,
  allowedSourceNoteIds: ReadonlySet<string>,
): BookCardDeckValue {
  const deck = bookCardDeckSchema.parse(value);
  const titles = new Set<string>();

  for (const card of deck.cards) {
    const normalizedTitle = card.title.toLocaleLowerCase();
    if (titles.has(normalizedTitle)) {
      throw new Error("The generated deck contained duplicate card titles.");
    }
    titles.add(normalizedTitle);

    for (const point of card.points) {
      point.sourceNoteIds = Array.from(new Set(point.sourceNoteIds));
      if (point.sourceNoteIds.some((noteId) => !allowedSourceNoteIds.has(noteId))) {
        throw new Error("A generated card cited a note outside this book.");
      }
    }
  }
  return deck;
}
