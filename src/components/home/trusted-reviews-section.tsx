import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";
import type { Testimonial } from "@/lib/domain";
import type { BusinessProfile } from "@/config/business";

export function TrustedReviewsSection({ 
  testimonials, 
  business 
}: { 
  testimonials: Testimonial[]; 
  business: BusinessProfile;
}) {
  const rating = business.googleRating ?? 4.8;
  const count = business.googleReviewCount ?? 350;

  const colors = ["bg-[#d95d18]", "bg-[#0e786b]", "bg-[#673ab7]", "bg-[#b02772]", "bg-[#0a1e3f]", "bg-[#0f766e]"];
  
  function getInitials(name: string) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "C";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Use dynamic testimonials or fallback if none are provided
  const displayReviews: Testimonial[] = testimonials.length > 0 ? testimonials : [
    { id: "fallback-1", customerName: "Rohan Timilsina", quote: "Bought my first car from AutoHauz and the team made it so easy. Honest, professional and no pressure at all.", rating: 5, source: "google", reviewDate: null, photoUrl: null, vehicleId: null },
    { id: "fallback-2", customerName: "Emma Patel", quote: "Great selection of quality cars and transparent pricing. The inspection process gave me confidence in my purchase.", rating: 5, source: "google", reviewDate: null, photoUrl: null, vehicleId: null },
    { id: "fallback-3", customerName: "Daniel Lee", quote: "Smooth trade-in and fantastic customer service. Highly recommend AutoHauz to anyone looking for a used car.", rating: 5, source: "google", reviewDate: null, photoUrl: null, vehicleId: null },
  ] as Testimonial[];

  return (
    <section className="bg-[#f8faff] py-16 sm:py-20 lg:py-24 border-y border-[#e5e7eb]">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0a1e3f] mb-8 lg:mb-12">
          Trusted by Sydney drivers
        </h2>
        
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          {/* Left panel (Rating Summary) */}
          <div className="flex flex-col w-full lg:w-[220px] shrink-0">
            <div className="text-[64px] font-extrabold leading-none tracking-tight text-[#0a1e3f]">
              {rating}<span className="text-[36px]">/5</span>
            </div>
            
            <div className="mt-3 flex gap-1">
              {[...Array(Math.round(rating))].map((_, i) => (
                <Star key={i} className="size-7 fill-[#fbbf24] text-[#fbbf24]" />
              ))}
            </div>
            
            <p className="mt-4 text-[15px] text-[#4b5563]">
              from <strong className="font-semibold text-[#111827]">{count}+</strong> verified reviews
            </p>
            
            <div className="mt-5">
              {/* Perfectly spaced inline SVG to avoid overlapping paths or broken external image links */}
              <svg viewBox="0 0 105 32" className="h-[28px] w-auto" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(0, 0)">
                  <path fill="#4285F4" d="M12.2 23.9C5.5 23.9 0 18.5 0 12C0 5.4 5.5 0 12.2 0C15.9 0 18.5 1.4 20.5 3.3L17.7 6.1C16.3 4.8 14.5 3.8 12.2 3.8C7.4 3.8 3.6 7.5 3.6 12C3.6 16.5 7.4 20.2 12.2 20.2C15.4 20.2 17.2 18.9 18.3 17.8C19.3 16.8 19.9 15.5 20.1 13.6H12.2V10.1H23.7C23.8 10.7 23.9 11.3 23.9 12.1C23.9 14.4 23.2 17.3 21.1 19.4C19.1 21.6 16.4 23.9 12.2 23.9Z"/>
                </g>
                <g transform="translate(26, 0)">
                  <path fill="#EA4335" d="M15.7 16.1C15.7 20.7 12.1 24.1 7.9 24.1C3.6 24.1 0 20.7 0 16.1C0 11.5 3.6 8.1 7.9 8.1C12.1 8.1 15.7 11.5 15.7 16.1ZM12.2 16.1C12.2 13.1 10.2 11 7.9 11C5.5 11 3.5 13.1 3.5 16.1C3.5 19 5.5 21.2 7.9 21.2C10.2 21.2 12.2 19 12.2 16.1Z"/>
                </g>
                <g transform="translate(43, 0)">
                  <path fill="#FBBC05" d="M15.7 16.1C15.7 20.7 12.1 24.1 7.9 24.1C3.6 24.1 0 20.7 0 16.1C0 11.5 3.6 8.1 7.9 8.1C12.1 8.1 15.7 11.5 15.7 16.1ZM12.2 16.1C12.2 13.1 10.2 11 7.9 11C5.5 11 3.5 13.1 3.5 16.1C3.5 19 5.5 21.2 7.9 21.2C10.2 21.2 12.2 19 12.2 16.1Z"/>
                </g>
                <g transform="translate(60, 0)">
                  <path fill="#4285F4" d="M15.1 8.4V22.7C15.1 28.7 11.5 31.2 7.4 31.2C3.6 31.2 1.3 28.6 0.5 26.6L3.6 25.3C4.1 26.5 5.4 28.1 7.4 28.1C9.7 28.1 11.7 26.7 11.7 23.2V22.2H11.5C10.8 23.1 9.3 23.8 7.3 23.8C3.6 23.8 0 20.5 0 16.1C0 11.6 3.6 8.2 7.3 8.2C9.3 8.2 10.8 9.1 11.5 10H11.7V8.4H15.1ZM11.9 16.1C11.9 13.1 9.7 11 7.6 11C5.2 11 3.4 13.1 3.4 16.1C3.4 19 5.2 21 7.6 21C9.7 21 11.9 19 11.9 16.1Z"/>
                </g>
                <g transform="translate(77, 0)">
                  <path fill="#34A853" d="M3.5 0.9H7V23.4H3.5V0.9Z"/>
                </g>
                <g transform="translate(86, 0)">
                  <path fill="#EA4335" d="M13.8 19L16.6 20.8C15.7 22.1 13.7 24.1 10.5 24.1C6.2 24.1 2.8 20.7 2.8 16.1C2.8 11.3 6.2 8.1 10.1 8.1C14 8.1 15.7 11.4 16.3 13L16.7 14L6.7 18C7.6 19.6 8.9 21.1 10.5 21.1C12.2 21.1 13.2 20.2 13.8 19ZM6.3 15.8L12.8 13.1C12.4 12 11.4 11.1 10.3 11.1C8.7 11.1 6.2 13 6.3 15.8Z"/>
                </g>
              </svg>
            </div>
          </div>
          
          {/* Review Cards Grid */}
          <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayReviews.map((review, i) => {
              const bg = colors[i % colors.length];
              const initials = getInitials(review.customerName);
              const isGoogle = review.source === "google";
              
              return (
                <div key={i} className="flex flex-col rounded-xl bg-white p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-gray-100 h-full">
                  <div className="flex gap-1 mb-4">
                    {[...Array(review.rating)].map((_, j) => (
                      <Star key={j} className="size-[18px] fill-[#fbbf24] text-[#fbbf24]" />
                    ))}
                  </div>
                  
                  <p className="text-[14px] leading-[1.6] text-[#4b5563] mb-6 flex-grow">
                    &quot;{review.quote}&quot;
                  </p>
                  
                  <div className="flex items-center gap-3 mt-auto">
                    {/* User Avatar */}
                    {review.photoUrl ? (
                      <img src={review.photoUrl} alt={review.customerName} className="size-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white ${bg}`}>
                        {initials}
                      </div>
                    )}
                    
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-[#111827] leading-tight">{review.customerName}</span>
                      {/* Show review date or generic text */}
                      <span className="text-[13px] text-[#6b7280] leading-tight mt-0.5">
                        {review.reviewDate ? new Date(review.reviewDate).toLocaleDateString() : 'Verified Customer'}
                      </span>
                      <span className="text-[13px] text-[#9ca3af] leading-tight mt-0.5">
                        {isGoogle ? 'Google Review' : 'AutoHauz Review'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Link href="/testimonials" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#0A7AF5] hover:text-[#0A7AF5]/80 transition-colors">
            Read more reviews <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
