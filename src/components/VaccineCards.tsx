import { Check, CircleHelp, X } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { requiredVaccines, vaccineLabel, type ComplianceIssue, type Service, type Species, type VaccineDates } from "@/lib/vaccines";

export function VaccineCards({
  species,
  service,
  dates,
  issues,
}: {
  species: Species;
  service: Service;
  dates: VaccineDates;
  issues: ComplianceIssue[];
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
      {requiredVaccines(species, service).map((key) => {
        const issue = issues.find((i) => i.vaccine === key);
        const tone = !issue
          ? { card: "bg-[#e7f7ef]", badge: "bg-mint", label: "text-mint-ink", text: "Valid until", icon: <Check className="size-4" strokeWidth={3} aria-hidden="true" /> }
          : issue.kind === "missing"
            ? { card: "bg-sun-soft", badge: "bg-sun-ink", label: "text-sun-ink", text: "Couldn't read", icon: <CircleHelp className="size-4" strokeWidth={2.6} aria-hidden="true" /> }
            : {
                card: "bg-rose-soft shadow-[inset_0_0_0_2px_#f08d78]",
                badge: "bg-rose",
                label: "text-rose-ink",
                text: issue.kind === "expired" ? "Expired on" : "Runs out during visit",
                icon: <X className="size-4" strokeWidth={3} aria-hidden="true" />,
              };
        return (
          <div key={key} className={`rounded-[20px] p-4.5 ${tone.card}`}>
            <div className="flex items-center justify-between">
              <span className="font-display text-xl font-semibold">{vaccineLabel(key, species)}</span>
              <span className={`inline-flex size-7.5 items-center justify-center rounded-full text-white ${tone.badge}`}>{tone.icon}</span>
            </div>
            <div className={`mt-3.5 text-[13px] font-bold ${tone.label}`}>{tone.text}</div>
            <div className={`text-lg font-extrabold ${issue && issue.kind !== "missing" ? tone.label : ""}`}>
              {dates[key] ? formatDate(dates[key]) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
