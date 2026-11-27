
import { useEffect, useState } from "react";
import slide1 from "../../assets/images/hero/slide1.jpg";
import slide2 from "../../assets/images/hero/slide2.jpg";
import slide3 from "../../assets/images/hero/slide3.jpg";

const slides = [
  {
    image: slide1,
    eyebrow: "OAK COURSE FEEDBACK",
    title: "Your Voice Shapes\nBetter Courses",
    description:
      "Share your experience. Help us improve teaching quality and course content.",
    button: "Explore Surveys",
  },
  {
    image: slide2,
    eyebrow: "YOUR OPINION MATTERS",
    title: "Every Feedback\nMakes a Difference",
    description:
      "Your honest feedback helps create a better learning experience for everyone.",
    button: "Share Your Feedback",
  },
  {
    image: slide3,
    eyebrow: "BUILD A BETTER EXPERIENCE",
    title: "Learn Better.\nGrow Together.",
    description:
      "Take a moment to share your thoughts about your courses and instructors.",
    button: "View Available Surveys",
  },
];

function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Automatically change slides every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((previous) => (previous + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((previous) => (previous + 1) % slides.length);
  };

  const previousSlide = () => {
    setCurrentSlide(
      (previous) => (previous - 1 + slides.length) % slides.length
    );
  };

  return (
    <section className="relative mx-4 mt-3 h-[360px] overflow-hidden rounded-2xl shadow-lg md:mx-8 md:h-[430px] lg:h-[460px]">

      {/* Background Images */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            currentSlide === index
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <img
            src={slide.image}
            alt="OAK student learning environment"
            className="h-full w-full object-cover"
          />
        </div>
      ))}

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#172D25]/85 via-[#2B5748]/45 to-transparent" />

      {/* Hero Content */}
      <div
        key={currentSlide}
        className="absolute inset-y-0 left-0 flex max-w-3xl flex-col justify-center px-8 pb-10 text-white md:px-16 lg:px-20"
      >
        <p className="mb-4 text-xs font-semibold tracking-[4px] text-[#DED4AF] md:text-sm">
          {slides[currentSlide].eyebrow}
        </p>

        <h1 className="whitespace-pre-line font-serif text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
          {slides[currentSlide].title}
        </h1>

        <p className="mt-5 max-w-lg text-sm leading-7 text-white/90 md:text-base">
          {slides[currentSlide].description}
        </p>

        <a
          href="#surveys"
          className="mt-7 flex w-fit items-center gap-4 rounded-full bg-[#DED4AF] px-7 py-3.5 text-sm font-semibold text-[#2B5748] shadow-md transition duration-300 hover:-translate-y-1 hover:bg-white"
        >
          {slides[currentSlide].button}
          <span className="text-lg">→</span>
        </a>
      </div>

      {/* Previous Button */}
      <button
        type="button"
        onClick={previousSlide}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/20 text-2xl text-white backdrop-blur-sm transition hover:bg-white hover:text-[#2B5748] md:left-6 md:h-12 md:w-12"
      >
        ‹
      </button>

      {/* Next Button */}
      <button
        type="button"
        onClick={nextSlide}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/20 text-2xl text-white backdrop-blur-sm transition hover:bg-white hover:text-[#2B5748] md:right-6 md:h-12 md:w-12"
      >
        ›
      </button>

      {/* Navigation Dots */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrentSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-2.5 rounded-full border border-white transition-all duration-300 ${
              currentSlide === index
                ? "w-8 bg-white"
                : "w-2.5 bg-white/30 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

export default HeroCarousel;
