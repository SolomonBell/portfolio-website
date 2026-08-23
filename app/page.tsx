import Navbar from "./components/Navbar";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Projects from "./sections/Projects";
import Investing from "./sections/Investing";
// Certificates section temporarily hidden from the public site — the
// implementation is preserved; uncomment this import and the <Certificates />
// render below (and the nav entry in app/lib/constants.ts) to restore it.
// import Certificates from "./sections/Certificates";
import Athletics from "./sections/Athletics";
import Contact from "./sections/Contact";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <Navbar />
      <Hero />
      <About />
      <Projects />
      <Investing />
      {/* <Certificates /> */}
      <Athletics />
      <Contact />
    </main>
  );
}
