import type { SVGProps } from 'react';

const CowIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18.8 8.01h.01" />
    <path d="M19.3 2.8A2.5 2.5 0 0 1 22 5.3v10.4a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 6 15.7V5.3A2.5 2.5 0 0 1 8.5 2.8" />
    <path d="M8 18.2v-1.46a4.75 4.75 0 0 1 4.75-4.75h0a4.75 4.75 0 0 1 4.75 4.75V18.2" />
    <path d="M8.8 3.5a1.5 1.5 0 0 0-3.3 0" />
    <path d="M2 13.6a1 1 0 0 0 1 1h2" />
  </svg>
);

export default function Logo() {
  return (
    <div className="flex items-center justify-center gap-2 text-primary">
      <div className="rounded-lg bg-primary/10 p-2">
        <CowIcon className="h-6 w-6" />
      </div>
      <span className="text-xl font-bold font-headline text-foreground">
        GauRakshak
      </span>
    </div>
  );
}
