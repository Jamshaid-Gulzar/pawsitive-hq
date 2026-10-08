"use client";

import { Camera, Check, CircleCheck, LoaderCircle, Send } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { sendUpdate } from "@/app/actions";
import { PetPhoto } from "@/components/ui";
import { CARE_NOTES, MOODS, buildUpdateText, careNoteLabel, updateTags, type CareNoteId, type Mood } from "@/lib/care";
import { compressImage, isImageFile } from "@/lib/image";

type ComposerPet = { id: string; name: string; sex: "f" | "m"; photo: string | null; owner: string; where: string };

export function Composer({ pets, initialPetId }: { pets: ComposerPet[]; initialPetId?: string }) {
  const [petId, setPetId] = useState(pets.some((p) => p.id === initialPetId) ? initialPetId! : pets[0].id);
  const [photo, setPhoto] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood>("Happy");
  const [notes, setNotes] = useState<CareNoteId[]>(["ate", "walk"]);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const pet = pets.find((p) => p.id === petId)!;
  const shownPhoto = photo ?? pet.photo;
  const moodStyle = MOODS.find((m) => m.id === mood)!;

  function pickPet(id: string) {
    setPetId(id);
    setPhoto(null);
    setSentTo(null);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!isImageFile(file)) {
      setError("Please choose a JPG or PNG photo.");
      return;
    }
    setError(null);
    setPhoto(await compressImage(file, 1000, 0.78));
  }

  function send() {
    startTransition(async () => {
      setError(null);
      const r = await sendUpdate({ petId, photo, mood, notes });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSentTo(pet.owner);
      setPhoto(null);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section aria-label="Compose" className="flex min-w-0 flex-col gap-5">
        <div role="radiogroup" aria-label="Choose a pet" className="flex gap-2 overflow-x-auto pb-1">
          {pets.map((p) => {
            const selected = p.id === petId;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => pickPet(p.id)}
                className={`flex w-[84px] shrink-0 flex-col items-center gap-1.5 rounded-[18px] px-1 py-2 transition ${selected ? "bg-coral-soft" : "hover:bg-sand"}`}
              >
                <PetPhoto
                  src={p.photo}
                  alt=""
                  sizes="56px"
                  className={`size-14 rounded-full border-[3px] ${selected ? "border-coral" : "border-white"}`}
                />
                <span className="text-[13px] font-extrabold">{p.name}</span>
              </button>
            );
          })}
        </div>

        <div className="relative h-64 overflow-hidden rounded-[26px] bg-lilac-soft sm:h-72">
          <PetPhoto src={shownPhoto} alt={`Photo of ${pet.name}`} className="h-full w-full" sizes="(min-width: 1024px) 640px, 100vw" />
          <span className="absolute top-3.5 left-3.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-extrabold">
            {pet.name} · {pet.where}
          </span>
          {!photo && (
            <span className="absolute top-3.5 right-3.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-white">Profile photo</span>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
            aria-label={`Take or choose a photo of ${pet.name}`}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="absolute right-3.5 bottom-3.5 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold shadow-float transition hover:bg-cream"
          >
            <Camera className="size-4.5" aria-hidden="true" />
            {photo ? "Retake photo" : "Take a photo"}
          </button>
        </div>

        <div role="radiogroup" aria-label="Mood" className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] font-extrabold tracking-[0.06em] text-muted uppercase">Mood</span>
          {MOODS.map((m) => {
            const selected = m.id === mood;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMood(m.id)}
                className={`min-h-11 rounded-full border-2 px-4 text-sm font-extrabold transition ${
                  selected ? `${m.soft} ${m.ink} ${m.ring}` : "border-line bg-white hover:bg-cream"
                }`}
              >
                {m.id}
              </button>
            );
          })}
        </div>

        <fieldset>
          <legend className="mb-2.5 text-[13px] font-extrabold tracking-[0.06em] text-muted uppercase">Care notes</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {CARE_NOTES.map((n) => {
              const on = notes.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setNotes(on ? notes.filter((x) => x !== n.id) : [...notes, n.id])}
                  className={`flex min-h-12 items-center gap-2.5 rounded-2xl border-2 px-3.5 text-left text-[15px] font-bold transition ${
                    on ? "border-mint bg-[#e7f7ef]" : "border-line bg-white hover:bg-cream"
                  }`}
                >
                  <span
                    className={`inline-flex size-6 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-mint bg-mint text-white" : "border-[#b8b1a6] bg-white text-transparent"}`}
                  >
                    <Check className="size-3.5" strokeWidth={3.4} aria-hidden="true" />
                  </span>
                  {careNoteLabel(n.id, pet.sex)}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="prev-h" className="flex min-w-0 flex-col gap-3.5 self-start rounded-[28px] bg-white p-5 shadow-card lg:sticky lg:top-6">
        <div className="flex items-center justify-between gap-2.5">
          <h2 id="prev-h" className="font-display text-xl font-semibold">
            Text preview
          </h2>
          <span className="text-[13px] font-bold text-muted">To {pet.owner}</span>
        </div>
        <div className="flex min-h-[340px] flex-col justify-end rounded-[20px] bg-grape-soft p-3.5">
          <div className="max-w-[94%] self-start overflow-hidden rounded-[22px_22px_22px_8px] bg-white shadow-[0_4px_14px_rgb(27_31_59/0.08)]">
            <PetPhoto src={shownPhoto} alt="" className="h-40 w-full" sizes="380px" />
            <div className="px-3.5 pt-3 pb-3.5">
              <div className="font-display text-[17px] font-semibold text-grape">Pawsitive Update for {pet.name}!</div>
              <p className="mt-1.5 text-sm leading-relaxed">{buildUpdateText(pet.name, pet.sex, notes)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${moodStyle.soft} ${moodStyle.ink}`}>Mood: {mood}</span>
                {updateTags(notes).map((t) => (
                  <span key={t} className="rounded-full bg-mint-soft px-2.5 py-1 text-xs font-extrabold text-mint-ink">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-bold text-rose-ink">
            {error}
          </p>
        )}
        {sentTo && (
          <p role="status" className="animate-pop flex items-center gap-2 rounded-2xl bg-mint-soft px-4 py-3 text-sm font-extrabold text-mint-ink">
            <CircleCheck className="size-5" aria-hidden="true" /> Sent! {sentTo} will see it in their inbox.
          </p>
        )}
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="inline-flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-coral text-[17px] font-extrabold text-ink transition hover:brightness-95 active:scale-[0.98] disabled:opacity-70"
        >
          {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
          {pending ? "Sending…" : `Send to ${pet.owner}`}
        </button>
      </section>
    </div>
  );
}
