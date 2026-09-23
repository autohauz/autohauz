"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { 
  ShieldCheck, Wrench, CheckCircle2, HeartHandshake, Sparkles, ArrowRight 
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const DIFFERENCE_FEATURES = [
  { icon: ShieldCheck, title: "Carefully Sourced Vehicles", desc: "Quality you can rely on" },
  { icon: Wrench, title: "Professionally Reconditioned", desc: "Prepared for the road" },
  { icon: CheckCircle2, title: "Thoroughly Inspected", desc: "Peace of mind in every purchase" },
  { icon: HeartHandshake, title: "Ongoing Support", desc: "We're here after you buy" },
];

export function DifferenceHeroSection() {
  return (
    <section className="py-12 bg-background" aria-labelledby="difference-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-[#040f24] text-white p-8 sm:p-12 lg:p-16 border border-white/10 shadow-2xl"
        >
          <div className="absolute inset-0 z-0">
            <Image
              src="/images/heroes/homepage-hero.jpg"
              alt="The AutoHauz Difference"
              fill
              className="object-cover object-center opacity-25"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#040f24] via-[#040f24]/95 to-transparent" />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column Text */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-accent-bright uppercase">
                <Sparkles className="size-4" />
                <span>ABOUT AUTOHAUZ</span>
              </div>
              <h2 id="difference-heading" className="text-3xl sm:text-4xl lg:text-5xl font-black font-heading tracking-tight text-white">
                The AutoHauz difference
              </h2>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl">
                We buy quality used cars, professionally recondition them, inspect them thoroughly and offer them to new owners with confidence. It&apos;s a better way to buy a used car.
              </p>
              <div className="pt-4">
                <ButtonLink href="/how-it-works" size="lg" className="w-fit bg-primary hover:bg-primary/90 text-primary-foreground">
                  Our story <ArrowRight className="size-4 ml-1.5" />
                </ButtonLink>
              </div>
            </div>

            {/* Right Column Glassmorphic Features */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-5 bg-[#0a1936]/80 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-8 space-y-6"
            >
              {DIFFERENCE_FEATURES.map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent-bright border border-accent/30 mt-0.5">
                    <item.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{item.title}</h3>
                    <p className="text-xs text-slate-300 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
