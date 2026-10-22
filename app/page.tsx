import { Reel } from "@/components/reel";
import { PrismBackground } from "@/components/prism/prism-background/prism-background";

export default function HomePage() {
  return (
    <>
      <section className="hero" data-hero-theme>
        <div className="starfield" aria-hidden="true" />
        <PrismBackground enabled />
        <div className="hero-foot" aria-hidden="true" />
        <div className="hero-stage">
          <div className="profile">
            <h1 className="name" lang="en">
              <a
                className="name-link"
                href="https://discord.gg/yvl"
                target="_blank"
                rel="noopener noreferrer"
                title="discord.gg/yvl"
              >
                <span>YOUNG</span>
                <span>VAMP</span>
                <span>LIFE</span>
              </a>
            </h1>
          </div>
          <div className="prism-slot" data-triangle-container aria-hidden="true" />
        </div>
        <footer className="footer" lang="en">
          YOUNG VAMP LIFE <span>·</span> 2026
        </footer>
      </section>

      <Reel />
    </>
  );
}
