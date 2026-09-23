import { cn } from "@/lib/utils";

/** Engraved zone label. It is the section heading itself, not an eyebrow above one. */
export function Plate({
  as: Tag = "h2",
  id,
  children,
  aside,
  className,
}: {
  as?: "h1" | "h2" | "h3";
  id?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Tag id={id} className="plate">
        {children}
      </Tag>
      <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
      {aside && <div className="plate-text text-ink-dim">{aside}</div>}
    </div>
  );
}
