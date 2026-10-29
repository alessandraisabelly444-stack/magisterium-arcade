interface ComingSoonNoticeProps {
  label: string;
}

export function ComingSoonNotice({ label }: ComingSoonNoticeProps) {
  return (
    <div
      className="pixel-panel fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-sm p-4 text-center font-arcade text-xs text-arcade-violet sm:bottom-6"
      role="status"
      aria-live="polite"
    >
      {label} — EM BREVE
    </div>
  );
}
