"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const HELPFUL_GUIDES = [
  {
    title: "What to check before buying a used car",
    desc: "Practical tips to help you make a confident decision.",
    image: "/images/heroes/homepage-hero.jpg",
    href: "/faqs",
  },
  {
    title: "A simple guide to car finance in Australia",
    desc: "Understand your options and what to consider.",
    image: "/images/heroes/finance-hero.jpg",
    href: "/finance",
  },
  {
    title: "How to get the best value when selling your car",
    desc: "Expert advice to help you get a great result.",
    image: "/images/heroes/sell-car-hero.jpg",
    href: "/sell-your-car",
  },
];

export function HelpfulGuidesSection() {
  return (
    <section className="py-12 bg-background" aria-labelledby="guides-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2 id="guides-heading" className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
              Helpful guides
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tips and advice to help you buy, sell and own with confidence.
            </p>
          </div>
          <Link 
            href="/faqs" 
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline transition-colors"
          >
            View all articles <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HELPFUL_GUIDES.map((g, idx) => (
            <motion.div
              key={g.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                <Image
                  src={g.image}
                  alt={g.title}
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <h3 className="text-lg font-bold font-heading leading-snug group-hover:text-primary transition-colors">
                    {g.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {g.desc}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/50">
                  <Link href={g.href} className="inline-flex items-center text-xs font-bold text-primary hover:underline">
                    Read more <ArrowRight className="size-3.5 ml-1" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
