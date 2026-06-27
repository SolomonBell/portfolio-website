import ProjectFlipCard, { type Project } from "../components/ui/ProjectFlipCard";

const projects: Project[] = [
  {
    title: "Maintenance Booking System",
    description:
      "Automated maintenance booking system for a self-storage business, handling scheduling, intake, payments, and confirmations through a unified workflow.",
    skills: [
      "Google Apps Script",
      "Pipedream",
      "Stripe API",
      "DocuSeal API",
      "SendGrid",
      "Google Workspace APIs",
      "Webhooks",
      "Multi-System Orchestration",
      "Event-Driven Architecture",
      "Serverless Backend",
    ],
    links: [
      {
        label: "GitHub",
        href: "https://github.com/SolomonBell/reliable-storage-script",
      },
      {
        label: "Video Walkthrough",
        href: "https://www.youtube.com/watch?v=v4nrowu-jsk",
      },
      {
        label: "Company Site",
        href: "https://www.reliablestorage.com/",
      },
    ],
    subtitle: "Client Project",
    image: "/images/maintenance-script.jpg",
    collaboration: "collaborative",
    collaborationHref: "https://www.reliablestorage.com/",
  },
  {
    title: "Moving Vehicle System",
    description:
      "Production cloud automation platform managing the complete truck rental lifecycle for a commercial self-storage company — synchronizing bookings, processing payments, generating electronic lease documents, and delivering automated SMS and email notifications through an event-driven workflow.",
    skills: [
      "Google Apps Script",
      "Pipedream",
      "Stripe API",
      "DocuSeal API",
      "Twilio",
      "SendGrid",
      "Google Workspace",
      "Webhooks",
      "Event-Driven",
      "Serverless",
    ],
    links: [
      {
        label: "GitHub",
        href: "https://github.com/SolomonBell/reliable-storage-script",
      },
      // TODO: add Video Walkthrough URL when available
      {
        label: "Video Walkthrough",
      },
      {
        label: "Company Site",
        href: "https://www.reliablestorage.com/",
      },
    ],
    subtitle: "Client Project",
    image: "/images/maintenance-script.jpg",
    collaboration: "collaborative",
    collaborationHref: "https://www.reliablestorage.com/",
  },
  {
    title: "Flashcards Platform",
    description:
      "Built a spaced-repetition web app for multi-user classrooms with shared decks, AI grading, and flashcard generation. Implemented staged recall algorithms, dual-storage architecture, a Node.js AI proxy, and session analytics with CSV export while refining the product through stakeholder interviews.",
    skills: [
      "JavaScript",
      "Node.js",
      "Supabase",
      "REST APIs",
      "Spaced Repetition",
      "Analytics",
      "Railway",
      "HTML/CSS",
    ],
    links: [
      {
        label: "Live Site",
        href: "https://firststepstudy.com",
      },
      {
        label: "GitHub",
        href: "https://github.com/SolomonBell/flashcards-app",
      },
    ],
    subtitle: "Personal Project",
    image: "/images/flashcards-preview.jpg",
    collaboration: "collaborative",
  },
];

export default function Projects() {
  return (
    <section
      id="projects"
      className="mx-auto max-w-5xl px-6 py-16 border-t border-white/10"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-center">
        Projects
      </h2>

      <div className="mt-8 flex gap-6 overflow-x-auto pb-2">
        {projects.map((project) => (
          <ProjectFlipCard key={project.title} project={project} />
        ))}

        <div className="h-72 w-105 shrink-0 rounded-2xl border border-dashed border-white/15 p-5 flex items-center justify-center">
          <h3 className="font-medium text-neutral-400">
            More Projects Coming Soon
          </h3>
        </div>
      </div>
    </section>
  );
}
