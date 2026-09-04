/** Renders a member's uploaded/Google photo, or an initial in a circle when
 * there isn't one. `className` sizes both states identically; the fallback's
 * look is customizable per call site since it differs across the app. */
export function Avatar({
  photoUrl,
  name,
  className = "h-11 w-11",
  fallbackClassName = "border border-[#e8d9ad] bg-[linear-gradient(150deg,#fbf3df,#f5e6bf)] font-mono text-navy",
  textClassName = "text-[15px]",
}: {
  photoUrl?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
  textClassName?: string;
}) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- external Cloudinary/Google URLs, not a local asset
    return <img src={photoUrl} alt={name} className={`flex-none rounded-full object-cover ${className}`} />;
  }
  return (
    <div className={`grid flex-none place-items-center rounded-full ${fallbackClassName} ${className}`}>
      <span className={textClassName}>{name[0]?.toUpperCase() ?? "?"}</span>
    </div>
  );
}
