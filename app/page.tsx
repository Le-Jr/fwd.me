import Composer from "@/components/Composer";
import Ticker from "@/components/Ticker";

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="kicker">&gt; FW: FW: FW: ouve essa</p>
        <h1>
          Manda música pra quem usa <mark>outro streaming</mark>.
        </h1>
        <p className="lede">
          Cola links do <strong>Spotify</strong>, <strong>YouTube</strong>, <strong>Deezer</strong> ou{" "}
          <strong>Amazon Music</strong>, ou uma playlist inteira do Deezer. O fwd.fm gera um link e cada amigo
          abre no app que usa.
        </p>
      </section>

      <Ticker />
      <Composer />

      <ol className="steps">
        <li>
          <b>01</b>cola os links ou busca pelo nome
        </li>
        <li>
          <b>02</b>gera o link e manda no grupo
        </li>
        <li>
          <b>03</b>cada um ouve onde quiser
        </li>
      </ol>
    </>
  );
}
