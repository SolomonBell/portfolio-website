import Image from "next/image";

export default function Athletics() {
  return (
    <section
      id="athletics"
      className="mx-auto max-w-5xl px-6 py-16 border-t border-white/10"
    >
      <div className="grid gap-10 md:grid-cols-[180px_1fr]">
        <div className="relative h-44 w-44 overflow-hidden rounded-2xl border border-white/10 mx-auto md:mx-0">
          <Image
            src="/images/rowing.jpg"
            alt="Rowing training"
            fill
            className="object-cover"
          />
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-center">
            Athletics
          </h2>

          <div className="mt-4 max-w-3xl space-y-4 text-neutral-300 leading-relaxed">
            <p className="indent-8">
              I am a high-performance athlete with the aspiration to compete at the international
              level. I have completed over 15 million meters on the indoor rower, plus 10 million
              on the water. In the past, I have rowed with Potomac Boat Club, Pocock Rowing Center,
              Central Pennsylvania Rowing Association, Bucknell University, and Seattle Scullers.
            </p>

            <p className="indent-8">
              If you want to view my day to day training, you can check out my{" "}
              <a
                href="https://www.strava.com/athletes/62781821"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline underline-offset-4 decoration-white/30 hover:decoration-white/70 transition"
              >
                Strava page
              </a>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
