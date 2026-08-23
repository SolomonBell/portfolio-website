import CertFlipCard, { type Certificate } from "../components/ui/CertFlipCard";

const certificates: Certificate[] = [
  {
    id: "bloomberg",
    title: "Bloomberg Market Concepts",
    subtitle: "Bloomberg · 10 hours",
    image: "/images/certificates/market-concepts.jpg",
    skills: [
      "Bloomberg Terminal",
      "Fixed Income",
      "Equities",
      "Capital Markets",
      "Bonds",
      "Equity Capital Markets",
    ],
    backClassName: "bg-neutral-900",
  },
  {
    id: "python",
    title: "Python for Everybody\nSpecialization",
    subtitle: "University of Michigan · 76 hours",
    image: "/images/certificates/python-for-everybody.jpg",
    skills: [
      "Python",
      "SQL",
      "SQLite",
      "Data Visualization",
      "Web Scraping",
      "REST APIs",
      "JSON",
      "XML",
      "Data Analysis",
    ],
    backClassName: "bg-neutral-900",
  },
  {
    id: "java",
    title: "Introduction to Java &\nObject-Oriented Programming",
    subtitle: "University of Pennsylvania · 18 hours",
    image: "/images/certificates/intro-programming.jpg",
    skills: [
      "Java",
      "Object-Oriented Programming",
      "Debugging",
      "Data Structures",
      "Algorithm Analysis",
    ],
    backClassName: "bg-neutral-900",
  },
];

export default function Certificates() {
  return (
    <section
      id="certificates"
      className="mx-auto max-w-5xl px-6 py-16 border-t border-white/10"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-center">
        Certificates
      </h2>

      <div className="mt-8 flex gap-6 overflow-x-auto pb-2">
        {certificates.map((cert) => (
          <CertFlipCard key={cert.id} cert={cert} />
        ))}
      </div>
    </section>
  );
}
