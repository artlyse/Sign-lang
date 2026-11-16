import type { ReactNode } from "react";

type StatTone = "blue" | "violet" | "green" | "orange" | "pink" | "cyan";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  tone?: StatTone;
}

function StatCard({
  title,
  value,
  description,
  icon = "▦",
  tone = "blue",
}: StatCardProps) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-icon">{icon}</div>

      <div>
        <span className="stat-title">{title}</span>
        <strong>{value}</strong>
        {description && <small>{description}</small>}
      </div>
    </div>
  );
}

export default StatCard;
