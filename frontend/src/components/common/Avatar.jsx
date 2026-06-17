export default function Avatar({ user, size = 36 }) {
  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  if (user?.avatarUrl) {
    return <img className="avatar avatar--img" style={style} src={user.avatarUrl} alt="" />;
  }

  return (
    <span className="avatar" style={style}>
      {initials}
    </span>
  );
}
