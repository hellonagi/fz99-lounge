interface AnonymousAvatarProps {
  name: string;
  color: string;
  size?: number;
}

export function AnonymousAvatar({ name, color, size = 32 }: AnonymousAvatarProps) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.45,
      }}
      aria-label={name}
      title={name}
    >
      {initial}
    </div>
  );
}
