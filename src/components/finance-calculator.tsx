"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { estimateRepayments, rateForTerm, comparisonRate } from "@/lib/finance";
import type { FinanceParams } from "@/lib/domain";
import { formatPrice } from "@/lib/nav";
import { cn } from "@/lib/utils";

const PRICE_MIN = 5_000;
const PRICE_MAX = 100_000;
const PRICE_STEP = 500;
const DEPOSIT_STEP = 250;
const TERM_MIN = 12;
const TERM_MAX = 84;

/** Accent fill up to the thumb, muted track beyond it. */
function fillStyle(value: number, min: number, max: number) {
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  return { background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--muted) ${pct}%, var(--muted) 100%)` };
}

export type FinanceSnapshot = {
  price: number;
  deposit: number;
  weekly: number;
  termMonths: number;
};

function Slider({
  id,
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  minLabel,
  maxLabel,
  valueText,
}: {
  id: string;
  label: React.ReactNode;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
  valueText?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-body">
          {label}
        </label>
        <output htmlFor={id} className="tabular text-lg font-semibold text-foreground">
          {valueLabel}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="finance-range"
        style={fillStyle(value, min, max)}
        aria-valuetext={valueText ?? valueLabel}
      />
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

/**
 * Repayment estimator. Sliders for price, deposit and term; the rate follows
 * the configured advertised rate with a term margin (see lib/finance). Fits a
 * 380 px sidebar and stretches to a full column on /finance.
 */
export function FinanceCalculator({
  price: initialPrice,
  params,
  onChange,
  className,
}: {
  price: number;
  params: FinanceParams;
  /** Fires whenever the buyer adjusts the calculator (used to prefill the enquiry form). */
  onChange?: (snapshot: FinanceSnapshot) => void;
  className?: string;
}) {
  const id = useId();
  const startPrice = Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.round(initialPrice)));
  const [price, setPrice] = useState<number>(startPrice);
  const [deposit, setDeposit] = useState<number>(Math.round(((params.depositPct / 100) * startPrice) / DEPOSIT_STEP) * DEPOSIT_STEP);
  const [termMonths, setTermMonths] = useState<number>(params.termMonths);

  // Deposit moves relative to the vehicle price: dragging the price keeps the
  // same deposit proportion (and it can never exceed the price).
  function handlePriceChange(next: number) {
    const ratio = price > 0 ? deposit / price : params.depositPct / 100;
    const scaled = Math.round((ratio * next) / DEPOSIT_STEP) * DEPOSIT_STEP;
    setPrice(next);
    setDeposit(Math.min(next, Math.max(0, scaled)));
  }

  const effectiveDeposit = Math.min(deposit, price);
  const depositPct = price > 0 ? Math.round((effectiveDeposit / price) * 100) : 0;
  const years = termMonths / 12;

  // Rate follows Australian secured car-loan practice: anchored to the
  // advertised (settings) rate at the standard term, with a small margin for
  // longer/shorter terms. Comparison rate is the regulated $30k/5yr benchmark.
  const effectiveRate = rateForTerm(params.annualRate, termMonths, params.termMonths);
  const compRate = useMemo(() => comparisonRate(params.annualRate), [params.annualRate]);
  const estimate = useMemo(
    () => estimateRepayments(price, params, { deposit: effectiveDeposit, termMonths, annualRate: effectiveRate }),
    [price, params, effectiveDeposit, termMonths, effectiveRate],
  );

  // Report the current configuration up so the enquiry form can prefill.
  useEffect(() => {
    onChange?.({ price, deposit: effectiveDeposit, weekly: estimate.weekly, termMonths });
  }, [onChange, price, effectiveDeposit, estimate.weekly, termMonths]);

  return (
    <section aria-labelledby={`${id}-heading`} className={cn("@container rounded-lg border border-border bg-card p-5", className)}>
      <h2 id={`${id}-heading`} className="text-lg font-semibold">
        Repayment estimate
      </h2>

      <div className="mt-5 space-y-5">
        <Slider
          id={`${id}-price`}
          label="Vehicle price"
          valueLabel={formatPrice(price)}
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={price}
          onChange={handlePriceChange}
          minLabel={formatPrice(PRICE_MIN)}
          maxLabel={`${formatPrice(PRICE_MAX)}+`}
        />
        <Slider
          id={`${id}-deposit`}
          label={
            <>
              Deposit <span className="text-muted-foreground">({depositPct}%)</span>
            </>
          }
          valueLabel={formatPrice(effectiveDeposit)}
          min={0}
          max={price}
          step={DEPOSIT_STEP}
          value={effectiveDeposit}
          onChange={setDeposit}
          minLabel="No deposit"
          maxLabel={formatPrice(price)}
        />
        <Slider
          id={`${id}-term`}
          label="Loan term"
          valueLabel={`${years} ${years === 1 ? "year" : "years"}`}
          min={TERM_MIN}
          max={TERM_MAX}
          step={12}
          value={termMonths}
          onChange={setTermMonths}
          minLabel="1 year"
          maxLabel="7 years"
        />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-sm @[420px]:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Loan amount</dt>
          <dd className="tabular font-semibold text-foreground">{formatPrice(estimate.principal)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Interest rate</dt>
          <dd className="tabular font-semibold text-foreground">{effectiveRate.toFixed(2)}% p.a.</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Comparison rate*</dt>
          <dd className="tabular font-semibold text-foreground">{compRate.toFixed(2)}% p.a.</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total interest</dt>
          <dd className="tabular font-semibold text-foreground">{formatPrice(estimate.totalInterest)}</dd>
        </div>
      </dl>

      <div className="mt-5 rounded-md bg-accent-soft p-4 text-accent-soft-foreground" aria-live="polite">
        <p className="text-sm font-medium">Estimated repayment</p>
        <p className="tabular mt-1 text-3xl font-bold leading-none">
          {formatPrice(estimate.weekly)}
          <span className="text-base font-normal"> / week</span>
        </p>
        <p className="mt-2 text-xs">
          Over {termMonths} months at {effectiveRate.toFixed(2)}% p.a.
        </p>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{params.disclaimer}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        *Comparison rate based on a $30,000 secured loan over 5 years. WARNING: this comparison rate is true only for the example given and may not include all fees and charges. Different terms, fees or loan amounts might result in a different comparison rate.
      </p>
    </section>
  );
}
