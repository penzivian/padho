export function LegalHeader({ title, updated }: { title: string; updated: string }) {
  return (
    <>
      <h1 className="font-serif text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="script-note mt-2 font-mono text-xs uppercase tracking-wider">
        Last updated {updated}
      </p>
    </>
  );
}
