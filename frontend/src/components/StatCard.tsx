interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: string;
}

function StatCard({
  title,
  value,
  description,
  icon = "▦",
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div>
        <span className="stat-title">{title}</span>

        <strong>{value}</strong>

        {description && (
          <small>{description}</small>
        )}
      </div>
    </div>
  );
}

export default StatCard;