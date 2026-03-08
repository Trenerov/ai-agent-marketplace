"use client";

import { useState } from "react";
import { phases } from "@/lib/site-data";

export default function PhaseRoadmap() {
  const [activeId, setActiveId] = useState(1);
  const active = phases.find((phase) => phase.id === activeId) ?? phases[0];

  return (
    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.34em] text-white/35">Implementation Plan</div>
          <h2 className="text-3xl font-semibold text-white">5-day delivery path from setup to demo</h2>
        </div>
        <div className="rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2 text-sm text-[#f7931a]">
          Built from the plan file
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {phases.map((phase) => (
          <button
            key={phase.id}
            onClick={() => setActiveId(phase.id)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              phase.id === active.id
                ? "bg-[#f7931a] text-black"
                : "border border-white/10 bg-black/20 text-white/65 hover:border-white/20 hover:text-white"
            }`}
          >
            {phase.emoji} {phase.title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[240px,1fr]">
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-white/35">Window</div>
          <div className="mt-2 text-2xl font-semibold text-white">{active.duration}</div>
          <div className="mt-4 text-xs uppercase tracking-[0.24em] text-white/35">Priority</div>
          <div className="mt-2 inline-flex rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-3 py-1 text-sm text-[#f7931a]">
            {active.priority}
          </div>
        </div>

        <div className="space-y-3">
          {active.tasks.map((task) => (
            <div key={task.name} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-lg font-medium text-white">{task.name}</h3>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">
                  {task.time}
                </span>
              </div>
              <p className="text-sm leading-6 text-white/62">{task.detail}</p>
              <div className="mt-3 rounded-2xl border border-[#f7931a]/20 bg-[#f7931a]/8 px-4 py-3 text-sm text-[#f7b15a]">
                {task.vibe}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
