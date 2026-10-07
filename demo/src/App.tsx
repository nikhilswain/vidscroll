import { useEffect, useState } from "react";
import { DEMOS } from "./demos";
import { Diagnostics } from "./Diagnostics";
import { Home } from "./Home";
import { Lab } from "./Lab";
import { TopBar } from "./TopBar";
import { ASSET_BASE, ON_SITE } from "./asset";

const slugFromHash = () => location.hash.replace(/^#\/?/, "");

export default function App() {
  const [slug, setSlug] = useState(slugFromHash);

  useEffect(() => {
    const onHashChange = () => {
      setSlug(slugFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (slug === "lab") return <Lab />;

  const demo = DEMOS.find((d) => d.slug === slug);
  if (!demo?.component && ON_SITE) {
    location.replace(`${ASSET_BASE}#demos`);
    return null;
  }
  if (!demo?.component) {
    return (
      <>
        <TopBar />
        <Home />
      </>
    );
  }

  const Demo = demo.component;
  return (
    <>
      <TopBar demo={demo} homeHref={ON_SITE ? `${ASSET_BASE}#demos` : "#/"} />
      <Demo key={demo.slug} />
      <Diagnostics key={`${demo.slug}-stats`} />
    </>
  );
}
