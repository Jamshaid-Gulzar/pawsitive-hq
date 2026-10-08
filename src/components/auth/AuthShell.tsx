import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { PetPhoto } from "@/components/ui";

const FACES = ["max", "bella", "shadow", "mochi", "pepper"];

/** The one sign-in / register layout every role uses: photo on the left, form on the right. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap p-3 sm:p-5">
      <section className="relative min-h-[300px] min-w-0 flex-[1_1_520px] overflow-hidden rounded-[34px] bg-ink sm:min-h-[560px] lg:min-h-[calc(100vh-40px)]">
        <Image src="/pets/hero.jpg" alt="A corgi and a terrier running together on a dirt path" fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
        <div className="absolute top-5 left-5 rounded-full bg-white py-2 pr-4 pl-2 sm:top-7 sm:left-7">
          <BrandLogo />
        </div>
        <div className="absolute top-28 right-5 hidden max-w-[300px] items-center gap-3 rounded-[20px] bg-white p-3 pr-4 shadow-float sm:right-7 sm:flex">
          <PetPhoto src="/pets/coco.jpg" alt="" className="size-12 shrink-0 rounded-[14px]" sizes="48px" />
          <p className="text-sm leading-snug">
            <strong>Coco is ready!</strong>
            <br />
            <span className="font-semibold text-muted">Styled and waiting for pickup</span>
          </p>
        </div>
        <div className="absolute top-52 right-16 hidden items-center gap-2 rounded-full bg-mint px-3.5 py-2.5 text-sm font-extrabold text-white shadow-float sm:inline-flex">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Max&apos;s vaccines verified
        </div>
        <div className="absolute inset-x-4 bottom-4 hidden rounded-[28px] bg-white p-6 sm:inset-x-7 sm:bottom-7 sm:block sm:p-8">
          <p className="font-display text-[34px] leading-[1.05] font-semibold sm:text-[44px]">
            Happy pets. Calm staff.
            <br />
            Zero paperwork.
          </p>
          <p className="mt-3 text-base leading-relaxed font-semibold text-muted sm:text-[17px]">
            Vaccine checks on autopilot, a live map of every kennel and grooming table, online payments, and photo updates owners can&apos;t stop smiling at.
          </p>
        </div>
      </section>

      <section className="flex min-w-0 flex-[1_1_460px] items-center justify-center px-4 py-10 sm:px-14">
        <div className="flex w-full max-w-[440px] flex-col gap-6">
          <div>
            <div className="mb-4 flex">
              {FACES.map((id, i) => (
                <PetPhoto key={id} src={`/pets/${id}.jpg`} alt="" sizes="50px" className={`size-[50px] rounded-full border-[3px] border-cream ${i ? "-ml-3.5" : ""}`} />
              ))}
            </div>
            <h1 className="font-display text-4xl font-semibold">{title}</h1>
            <p className="mt-1.5 text-base font-semibold text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
