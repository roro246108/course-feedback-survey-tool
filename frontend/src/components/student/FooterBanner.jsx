
function FooterBanner() {
  return (
    <footer className="mx-4 mb-6 mt-10 md:mx-8">
      <div className="relative flex min-h-[115px] items-center justify-between overflow-hidden rounded-[28px] bg-gradient-to-r from-[#A6B398] via-[#D5D9C8] to-[#DED4AF] px-6 py-6 md:px-10">

        {/* Decorative Background */}
        <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full border-[25px] border-white/20" />

        <div className="pointer-events-none absolute -right-16 -bottom-24 h-52 w-52 rounded-full bg-[#2B5748]/10" />

        {/* Message */}
        <div className="relative z-10 flex items-center gap-4">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2B5748]/10 text-[#2B5748]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-7 w-7"
            >
              <path d="M3 11v2a2 2 0 0 0 2 2h2l10 5V4L7 9H5a2 2 0 0 0-2 2Z" />
              <path d="m7 15 2 5h3l-2-4" />
              <path d="M20 9c1 1 1 5 0 6" />
            </svg>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#2B5748] md:text-base">
              Thank you for being an active member of our community!
            </h3>

            <p className="mt-1 text-xs text-[#4B5545] md:text-sm">
              Your feedback helps us build a better learning experience.
            </p>
          </div>
        </div>

        {/* Decorative Brand */}
        <div className="relative z-10 hidden text-right md:block">
          <p className="font-serif text-2xl italic text-[#2B5748]/80">
            Your Voice Matters.
          </p>
          <p className="mt-1 text-xs tracking-[3px] text-[#4B5545]">
            OAK COURSE FEEDBACK
          </p>
        </div>

      </div>
    </footer>
  );
}

export default FooterBanner;
