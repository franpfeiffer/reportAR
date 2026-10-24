import Link from "next/link";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" aria-label="ReportAR, ir al inicio" className={`inline-flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.055em] ${inverse ? "text-white" : "text-[#173735]"}`}>
      <svg aria-hidden="true" viewBox="0 0 42 42" className="h-9 w-9 shrink-0">
        <rect width="42" height="42" rx="11" fill={inverse ? "#DDEEE5" : "#116D63"}/>
        <path d="M20 5v32M5 21h32" stroke={inverse ? "#116D63" : "#E5F2EA"} strokeWidth="5"/>
        <circle cx="21" cy="21" r="6" fill="#E86F50"/>
      </svg>
      <span>Report<span className={inverse ? "text-[#F39A7E]" : "text-[#116D63]"}>AR</span></span>
    </Link>
  );
}
