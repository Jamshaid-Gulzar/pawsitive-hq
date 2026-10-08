"use client";

import { Camera, Cat, ChevronDown, Dog, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { addPet } from "@/app/actions";
import { ConditionsInput } from "@/components/ConditionsInput";
import { RecordScanner, type ScannedRecord } from "@/components/RecordScanner";
import { PawIcon } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { compressImage, isImageFile } from "@/lib/image";

const BREEDS = {
  dog: ["Mixed breed", "Labrador Retriever", "Golden Retriever", "French Bulldog", "German Shepherd", "Poodle", "Beagle", "Dachshund", "Shih Tzu", "Cocker Spaniel", "Siberian Husky", "Pug", "Chihuahua", "Border Collie"],
  cat: ["Domestic Shorthair", "Domestic Longhair", "Siamese", "Maine Coon", "Persian", "Ragdoll", "Bengal", "British Shorthair"],
};

const input = "min-h-13 w-full min-w-0 rounded-2xl border-2 border-line bg-white px-4 text-base font-semibold placeholder:font-normal placeholder:text-faint";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-extrabold">
      {label}
      {children}
      {hint && <span className="text-[13px] font-semibold text-muted">{hint}</span>}
    </label>
  );
}

export function AddPetForm({ ownerName }: { ownerName: string }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [species, setSpecies] = useState<"dog" | "cat">("dog");
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState<"f" | "m" | null>(null);
  const [birthday, setBirthday] = useState("");
  const [food, setFood] = useState("");
  const [meds, setMeds] = useState("");
  const [medTime, setMedTime] = useState("");
  const [alert, setAlert] = useState("");
  const [note, setNote] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [record, setRecord] = useState<ScannedRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const petName = name.trim() || "your pet";

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    if (!isImageFile(file)) {
      setError("Please choose a JPG or PNG photo.");
      return;
    }
    setError(null);
    setPhoto(await compressImage(file, 900, 0.8));
  }

  function save() {
    if (!sex) {
      setError(`Please choose ${petName}'s sex: female or male.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    startTransition(async () => {
      setError(null);
      const r = await addPet({
        name,
        species,
        breed,
        sex,
        birthday: birthday || null,
        photo,
        food,
        meds: meds || null,
        medTime: medTime || null,
        alert: alert || null,
        note: note || null,
        conditions,
        record,
      });
      if (r.ok) router.push(`/my/pets/${r.id}?welcome=1`);
      else {
        setError(r.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-7 pb-24">
      <div>
        <h1 className="font-display text-[30px] leading-tight font-semibold">Add a pet</h1>
        <p className="mt-1 text-[15px] font-semibold text-muted">Tell us about your furry family member so our team can care for them.</p>
      </div>

      {error && (
        <p role="alert" className="animate-pop rounded-2xl bg-rose-soft px-4 py-3 text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-2.5">
        <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} aria-label="Pet photo" />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="relative size-36 overflow-hidden rounded-full border-4 border-white bg-coral-soft shadow-card transition active:scale-95"
          aria-label={photo ? "Change photo" : "Add a photo"}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen photo
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-coral">
              <PawIcon className="size-16" />
            </span>
          )}
          <span className="absolute right-2 bottom-2 inline-flex size-10 items-center justify-center rounded-full bg-ink text-white">
            <Camera className="size-5" aria-hidden="true" />
          </span>
        </button>
        <span className="text-sm font-extrabold text-coral-ink">{photo ? "Looking good!" : "Add a photo"}</span>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 font-display text-[22px] font-semibold">The basics</legend>
        <div role="radiogroup" aria-label="Dog or cat" className="grid grid-cols-2 gap-2.5">
          {(
            [
              ["dog", "Dog", Dog],
              ["cat", "Cat", Cat],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={species === id}
              onClick={() => {
                setSpecies(id);
                setBreed("");
              }}
              className={`flex min-h-16 items-center justify-center gap-2.5 rounded-[20px] border-2 bg-white text-lg font-extrabold transition ${
                species === id ? "border-grape bg-grape-soft text-grape" : "border-line"
              }`}
            >
              <Icon className="size-6" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="off" placeholder="e.g. Luna" className={input} />
        </Field>

        <Field label="Breed">
          <input value={breed} onChange={(e) => setBreed(e.target.value)} list="breeds" maxLength={50} placeholder="Start typing…" className={input} />
          <datalist id="breeds">
            {BREEDS[species].map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>

        <div role="radiogroup" aria-label="Sex" className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold">Sex</span>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                ["f", "Female"],
                ["m", "Male"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={sex === id}
                onClick={() => setSex(id)}
                className={`min-h-13 rounded-2xl border-2 bg-white font-extrabold transition ${sex === id ? "border-coral bg-coral-soft text-coral-ink" : "border-line"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Birthday" hint="Optional — we celebrate birthdays at the facility!">
          <input type="date" value={birthday} max={todayISO()} onChange={(e) => setBirthday(e.target.value)} className={input} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 font-display text-[22px] font-semibold">Care notes</legend>
        <Field label="Food" hint="What, how much, and how often.">
          <input value={food} onChange={(e) => setFood(e.target.value)} maxLength={120} placeholder="e.g. 1 cup kibble, twice a day" className={input} />
        </Field>
        <Field label="Medication" hint="Leave blank if none.">
          <input value={meds} onChange={(e) => setMeds(e.target.value)} maxLength={120} placeholder="e.g. Apoquel, 1 tablet" className={input} />
        </Field>
        {meds.trim() && (
          <Field label="Medication time">
            <input type="time" value={medTime} onChange={(e) => setMedTime(e.target.value)} className={input} />
          </Field>
        )}
        <Field label="Anything staff must know?" hint="Allergies, fears, health issues.">
          <input value={alert} onChange={(e) => setAlert(e.target.value)} maxLength={80} placeholder="e.g. Chicken allergy" className={input} />
        </Field>
        <Field label="Fun fact" hint="Optional — helps us bond!">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="e.g. Loves belly rubs" className={input} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-display text-[22px] font-semibold">Health</legend>
        <p className="mb-1 text-[13px] font-semibold text-muted">
          Any illness or ongoing condition? Our in-house vet and staff will keep an eye on it. Leave empty if healthy.
        </p>
        <ConditionsInput value={conditions} onChange={setConditions} />
      </fieldset>

      <section aria-labelledby="vax-h" className="flex flex-col gap-3 rounded-[24px] bg-white p-4 shadow-card">
        <button type="button" onClick={() => setShowScanner(!showScanner)} aria-expanded={showScanner} className="flex items-center gap-3 text-left">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-mint-soft text-mint-ink">
            <ShieldCheck className="size-5.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span id="vax-h" className="block font-display text-lg font-semibold">
              Vaccine record <span className="text-sm font-bold text-muted">(optional)</span>
            </span>
            <span className="block text-sm font-semibold text-muted">Add it now and future bookings are approved instantly.</span>
          </span>
          <ChevronDown className={`size-5 shrink-0 transition ${showScanner ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {showScanner && <RecordScanner pet={{ name: petName, species, breed: breed || "Mixed" }} ownerName={ownerName} onChange={setRecord} />}
      </section>

      <div className="fixed inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[430px] bg-gradient-to-t from-cream from-60% to-transparent px-4 pt-6 pb-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-grape text-base font-extrabold text-white shadow-float transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : `Save ${name.trim() || "pet"}`}
        </button>
      </div>
    </div>
  );
}
