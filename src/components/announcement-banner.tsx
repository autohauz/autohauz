import { ArrowRight, MapPin } from "lucide-react";

export function AnnouncementBanner() {
  return (
    <div className="w-full bg-primary text-black py-3 px-4 relative z-50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center text-center sm:text-left gap-3 sm:gap-6 text-sm font-medium">
        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-2 font-bold">
            <MapPin className="size-4 animate-bounce" />
            <span>WE HAVE MOVED</span>
          </div>
          <span className="hidden sm:inline border-l border-black/20 h-4 mx-2"></span>
          <span className="font-bold">Cars 365 has moved to our new location!</span>
          <span className="font-bold">16 Hollywood Dr, Lansvale NSW 2166, Australia</span>
        </div>
        <a 
          href="https://maps.google.com/maps?q=16+Hollywood+Dr,+Lansvale+NSW+2166,+Australia" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-black/80 transition-colors shadow-sm"
        >
          Get Directions <ArrowRight className="size-3" />
        </a>
      </div>
    </div>
  );
}
