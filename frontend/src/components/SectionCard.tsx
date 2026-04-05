import { ReactNode } from "react";

export function SectionCard(props: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel fade-up rounded-2xl p-4 ${props.className ?? ""}`}>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        {props.description ? <p className="text-sm text-slate-700">{props.description}</p> : null}
      </div>
      {props.children}
    </section>
  );
}
