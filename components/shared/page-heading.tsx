export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#169b99]">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-[#102b48] md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-[#6a7e94]">{description}</p>
      </div>
      {action}
    </div>
  );
}
