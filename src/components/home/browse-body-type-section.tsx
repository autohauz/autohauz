"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BODY_TYPE_LABELS, NAV_BODY_TYPES, bodyTypeHref } from "@/lib/nav";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35 },
  },
};

export function BrowseBodyTypeSection() {
  return (
    <section className="py-12 bg-background" aria-labelledby="body-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h2 id="body-heading" className="speed-line text-2xl sm:text-3xl font-bold font-heading text-foreground">
            Browse by body type
          </h2>
          <Link 
            href="/used-cars" 
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline transition-colors"
          >
            View all body types <ArrowRight className="size-4" />
          </Link>
        </div>

        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-30px" }}
        >
          {NAV_BODY_TYPES.map((b) => (
            <motion.div key={b} variants={itemVariants}>
              <Link
                href={bodyTypeHref(b)}
                className="group relative flex flex-col justify-end overflow-hidden rounded-xl border border-border/60 bg-slate-900 aspect-[4/5] shadow-sm hover:shadow-md transition-all duration-300 block"
              >
                <Image
                  src={`/brand/body-types/${b}.jpg`}
                  alt={BODY_TYPE_LABELS[b]}
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="relative z-10 p-3.5 text-center">
                  <span className="font-heading text-sm sm:text-base font-bold text-white tracking-wide drop-shadow-md">
                    {BODY_TYPE_LABELS[b]}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
