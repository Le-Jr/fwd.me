import Link from "next/link";

export default function NotFound() {
  return (
    <section className="lost">
      <h1>404</h1>
      <p className="lede" style={{ marginInline: "auto" }}>
        Esse FWD se perdeu na caixa de spam.
      </p>
      <p className="cta">
        <Link href="/">← voltar e fazer um novo</Link>
      </p>
    </section>
  );
}
