import Link from "next/link";

type ProductWordmarkProps = {
  className?: string;
  href?: string;
};

function wordmarkContent() {
  return (
    <>
      <span>EpiNote</span>
      <sup className="wordmark-beta">Beta</sup>
    </>
  );
}

export function ProductWordmark({ className, href }: ProductWordmarkProps) {
  const classes = ["wordmark", className].filter(Boolean).join(" ");
  if (href) {
    return (
      <Link className={classes} href={href} aria-label="EpiNote Beta home">
        {wordmarkContent()}
      </Link>
    );
  }

  return <span className={classes}>{wordmarkContent()}</span>;
}
