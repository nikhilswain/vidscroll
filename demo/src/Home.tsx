import { DEMOS } from "./demos";
import "./home.css";

export function Home() {
  return (
    <main className="home">
      <header className="home__header">
        <h1>vidscroll</h1>
        <p>
          Scroll-scrubbed video for React. Each demo is one{" "}
          <code>&lt;ScrollVideo&gt;</code> with ordinary components and CSS on top.
        </p>
      </header>
      <ul className="home__list">
        {DEMOS.map((demo) => (
          <li key={demo.slug}>
            <a href={`#/${demo.slug}`}>
              <span className="home__name">{demo.title}</span>
              <span className="home__desc">{demo.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
