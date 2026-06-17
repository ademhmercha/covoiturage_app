export function SkeletonLine({ width = "100%", height = "16px" }) {
  return <div className="skeleton" style={{ width, height }} />;
}

export function SkeletonAvatar({ size = 32 }) {
  return <div className="skeleton skeleton--circle" style={{ width: size, height: size }} />;
}

export function SkeletonTripCard() {
  return (
    <div className="card skeleton-card">
      <div className="row" style={{ marginBottom: 8 }}>
        <SkeletonLine width="55%" height="20px" />
        <SkeletonLine width="20%" height="18px" />
      </div>
      <SkeletonLine width="35%" height="14px" />
      <div className="row" style={{ marginTop: 8 }}>
        <SkeletonAvatar size={28} />
        <SkeletonLine width="30%" height="14px" />
      </div>
    </div>
  );
}

export function SkeletonConversationCard() {
  return (
    <div className="card skeleton-card">
      <div className="row" style={{ marginBottom: 8 }}>
        <SkeletonAvatar size={36} />
        <SkeletonLine width="45%" height="18px" />
      </div>
      <SkeletonLine width="70%" height="14px" />
      <SkeletonLine width="50%" height="13px" />
    </div>
  );
}

export function SkeletonNotificationCard() {
  return (
    <div className="card skeleton-card" style={{ padding: "12px 16px" }}>
      <SkeletonLine width="80%" height="15px" />
      <SkeletonLine width="30%" height="12px" />
    </div>
  );
}

export function SkeletonList({ count = 3, variant = "trip" }) {
  const Component =
    variant === "conversation"
      ? SkeletonConversationCard
      : variant === "notification"
        ? SkeletonNotificationCard
        : SkeletonTripCard;
  return (
    <div className="list-stack">
      {Array.from({ length: count }, (_, i) => (
        <Component key={i} />
      ))}
    </div>
  );
}
