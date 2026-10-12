"use client";

import { useId, useRef, useState } from "react";

export type ProjectLink = {
  label: string;
  href?: string;
};

export type Project = {
  title: string;
  description: string;
  skills: string[];
  links: ProjectLink[];
  status?: string;
  subtitle?: string;
  image?: string;
  imageFit?: "cover" | "contain";
  collaboration?: "solo" | "collaborative";
  collaborationHref?: string;
  attribution?: string;
  teamMembers?: ProjectLink[];
};

const CARD_OVERLAY = "absolute inset-0 bg-black/40";

function TeamMembers({ members }: { members: ProjectLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-neutral-200 transition cursor-pointer"
      >
        Team Members ({members.length})
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-2.5 w-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id={panelId}
        ref={panelRef}
        className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        onTransitionEnd={() => {
          if (open) panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }}
      >
        <ul
          className={`overflow-hidden flex flex-wrap gap-x-4 gap-y-1 text-xs transition-[visibility] duration-200 ${open ? "visible" : "invisible"}`}
        >
          {members.map((member) => (
            <li key={member.label} className="pt-1">
              <a
                href={member.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-white hover:text-neutral-300 underline underline-offset-4 decoration-white/30 hover:decoration-white/60 transition"
              >
                {member.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ProjectFlipCard({ project }: { project: Project }) {
  const [hovered, setHovered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const showBack = isFlipped || hovered;
  const hasTeam = Boolean(project.teamMembers?.length);
  const hasDetails = Boolean(project.attribution) || hasTeam;

  const skills = (
    <div className={`flex flex-wrap ${hasDetails ? "gap-x-2 gap-y-1.5" : "gap-2"}`}>
      {project.skills.map((skill) => (
        <span
          key={skill}
          className="text-xs px-2.5 py-1 rounded-full border border-white/15 bg-white/10 text-neutral-200"
        >
          {skill}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="relative h-72 w-105 shrink-0 cursor-pointer select-none rounded-2xl overflow-hidden border border-white/10"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setHovered(false); }}
      onClick={() => { setHovered(false); setIsFlipped((f) => !f); }}
    >
      {!showBack ? (
        /* Front */
        <div className="absolute inset-0 bg-white/5">
          {project.image && (
            <div
              className={`absolute inset-0 bg-center opacity-25 ${project.imageFit === "contain" ? "bg-white bg-contain bg-no-repeat" : "bg-cover"}`}
              style={{ backgroundImage: `url(${project.image})` }}
            />
          )}
          <div className={CARD_OVERLAY} />

          <div className="relative h-full">
            {project.status && (
              <span className="absolute top-3 right-3 text-xs text-neutral-200 border border-white/20 bg-black/40 px-2 py-1 rounded-full">
                {project.status}
              </span>
            )}
            <div className="flex items-center h-full px-5">
              <div>
                <h3
                  className="font-medium text-white"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.95)" }}
                >
                  {project.title}
                </h3>
                {project.subtitle && (
                  <p
                    className="mt-1 text-sm text-white/70"
                    style={{ textShadow: "0 1px 4px rgba(0,0,0,0.95)" }}
                  >
                    {project.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Back */
        <div className={`absolute inset-0 bg-neutral-900 flex flex-col ${hasDetails ? "px-5 pt-5 pb-4" : "p-5"}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-white/60">{project.title}</h3>
            {project.collaboration && (
              project.collaboration === "collaborative" ? (
                <a
                  href={project.collaborationHref ?? "https://www.downtownschoolseattle.org/"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs px-2 py-0.5 rounded-full border border-white/15 bg-white/10 text-neutral-400 whitespace-nowrap hover:text-neutral-200 hover:border-white/30 transition"
                >
                  Built in Collaboration
                </a>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 bg-white/10 text-neutral-400 whitespace-nowrap">
                  Built Independently
                </span>
              )
            )}
          </div>

          {hasDetails ? (
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {skills}
              <div className="mt-2 border-t border-white/10 pt-1.5">
                {project.attribution && (
                  <>
                    <h4 className="text-xs font-medium text-white/60">Project Attribution</h4>
                    <p className="mt-1 text-xs leading-snug text-neutral-400">{project.attribution}</p>
                  </>
                )}
                {hasTeam && <TeamMembers members={project.teamMembers!} />}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center">{skills}</div>
          )}

          {project.links.length > 0 && (
            <div className="mt-3 flex justify-center gap-6 text-sm">
              {project.links.map((link) =>
                link.href ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-neutral-300 underline underline-offset-4 decoration-white/30 hover:decoration-white/60 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {link.label}
                  </a>
                ) : (
                  <span key={link.label} className="text-neutral-400 cursor-default">
                    {link.label}
                  </span>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
