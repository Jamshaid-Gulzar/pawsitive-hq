// Shared wording for grooming steps and Pawsitive Updates, used by both the
// staff screens and the server, so the preview always matches what is sent.

export const GROOM_STAGES = [
  { label: "Bathing", short: "Bath", action: "Move to drying", color: "bg-sky", soft: "bg-sky-soft", ink: "text-sky-ink" },
  { label: "Drying", short: "Dry", action: "Move to styling", color: "bg-amber", soft: "bg-amber-soft", ink: "text-amber-ink" },
  { label: "Styling", short: "Style", action: "Mark ready for pickup", color: "bg-lilac", soft: "bg-lilac-soft", ink: "text-lilac-ink" },
  { label: "Ready for pickup", short: "Ready", action: "Picked up — clear table", color: "bg-mint", soft: "bg-mint-soft", ink: "text-mint-ink" },
] as const;

export const READY_STAGE = GROOM_STAGES.length - 1;

/** What a pet can be doing right now, set by staff and shown live to the owner. */
export const ACTIVITIES = [
  "Playtime in the yard",
  "On a walk",
  "Meal time",
  "Nap time",
  "Cuddles with staff",
  "Bath & brush",
  "Resting in their run",
] as const;

/** Choices on the staff's daily report card. */
export const REPORT_OPTIONS = {
  meals: ["Ate everything", "Ate some", "Didn't eat"],
  potty: ["Normal", "Soft", "None yet"],
  moods: ["Happy", "Playful", "Calm", "Sleepy", "A bit shy"],
  activities: ["Morning walk", "Afternoon walk", "Group play", "Training games", "Cuddles", "Afternoon nap", "Pool time"],
} as const;

export const CANCEL_REASONS = [
  "Change of plans",
  "My pet is unwell",
  "Found another date",
  "Booked by mistake",
  "Other",
] as const;

export const MOODS = [
  { id: "Happy", soft: "bg-sun-soft", ink: "text-sun-ink", ring: "border-sun" },
  { id: "Playful", soft: "bg-coral-soft", ink: "text-coral-ink", ring: "border-coral" },
  { id: "Calm", soft: "bg-sky-soft", ink: "text-sky-ink", ring: "border-sky" },
  { id: "Sleepy", soft: "bg-lilac-soft", ink: "text-lilac-ink", ring: "border-lilac" },
] as const;

export type Mood = (typeof MOODS)[number]["id"];

export const CARE_NOTES = [
  { id: "ate", label: "Ate every bite", tag: "Ate well", phrase: "ate every bite of {their} meal" },
  { id: "walk", label: "Had a great walk", tag: "Great walk", phrase: "had a great walk" },
  { id: "calm", label: "Calm while groomed", tag: "Calm groom", phrase: "stayed so calm while being groomed" },
  { id: "friends", label: "Made new friends", tag: "Social butterfly", phrase: "made new friends in the play yard" },
  { id: "nap", label: "Took a cozy nap", tag: "Cozy nap", phrase: "took a cozy nap" },
  { id: "meds", label: "Took {their} meds", tag: "Meds given", phrase: "took {their} meds like a champ" },
  { id: "ready", label: "Ready for pickup", tag: "Ready", phrase: null },
] as const;

export type CareNoteId = (typeof CARE_NOTES)[number]["id"];

const their = (sex: "f" | "m") => (sex === "f" ? "her" : "his");

export function careNoteLabel(id: CareNoteId, sex: "f" | "m"): string {
  return CARE_NOTES.find((n) => n.id === id)!.label.replace("{their}", their(sex));
}

/** "Coco ate every bite of her meal, had a great walk and took a cozy nap. All fluffy and ready for pickup!" */
export function buildUpdateText(name: string, sex: "f" | "m", noteIds: CareNoteId[]): string {
  const phrases = CARE_NOTES.filter((n) => noteIds.includes(n.id) && n.phrase).map((n) =>
    n.phrase!.replaceAll("{their}", their(sex)),
  );
  let text = "";
  if (phrases.length === 1) text = `${name} ${phrases[0]}.`;
  else if (phrases.length > 1) text = `${name} ${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}.`;
  const ending = noteIds.includes("ready")
    ? " All fluffy and ready for pickup!"
    : text
      ? " More photos coming soon!"
      : `${name} is having a pawsome day with us. More photos coming soon!`;
  return (text + ending).trim();
}

export function updateTags(noteIds: CareNoteId[]): string[] {
  return CARE_NOTES.filter((n) => noteIds.includes(n.id)).map((n) => n.tag);
}
