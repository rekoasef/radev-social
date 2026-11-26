/** The video's folder: pastel tab with its two-digit number. Identity, never a state color. */
export function FolderTab({ code, color }: { code: string; color: number }) {
  return (
    <span className="folder-tab" style={{ background: `var(--folder-${color})` }}>
      <span className="sr-only">Carpeta </span>
      {code}
    </span>
  );
}
