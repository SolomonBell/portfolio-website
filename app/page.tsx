import Navbar from "./components/Navbar";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Projects from "./sections/Projects";
import Investing from "./sections/Investing";
import Certificates from "./sections/Certificates";
import Hobbies from "./sections/Hobbies";
import Contact from "./sections/Contact";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <Navbar />
      <Hero />
      <About />
      <Projects />
      <Investing />
      <Certificates />
      <Hobbies />
      <Contact />
    </main>
  );
}
