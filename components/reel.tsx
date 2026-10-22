"use client";

import { useEffect, useRef, useState } from "react";

interface Now {
  verb: string;
  title: string;
  detail: string;
  image: string | null;
}

interface Founder {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  tag: string;
  status: string;
  platform: string | null;
  now: Now | null;
}

interface Live {
  founders: Founder[];
  guild: {
    name: string;
    description: string;
    icon: string | null;
    banner: string | null;
    members: number | null;
    online: number | null;
    boosts: number | null;
    tag: string;
    invite: string;
  };
}

const EMPTY: Founder = {
  id: "",
  name: "founder",
  username: "",
  avatar: null,
  tag: "YVL",
  status: "offline",
  platform: null,
  now: null,
};

const FALLBACK: Live = {
  founders: [
    { ...EMPTY, id: "711086947170385970", name: "samet", username: "itellmymama" },
    { ...EMPTY, id: "719868014358560810", name: "31cekiyorum", username: ".31cekiyorum" },
  ],
  guild: {
    name: "Young Vamp Life",
    description: "The Official YVL Discord Server",
    icon: null,
    banner: null,
    members: null,
    online: null,
    boosts: null,
    tag: "YVL",
    invite: "https://discord.gg/yvl",
  },
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const format = (value: number | null) =>
  value == null ? "—" : new Intl.NumberFormat("en-US").format(value);

const VERB: Record<number, string> = {
  0: "Playing", 1: "Streaming", 2: "Listening to", 3: "Watching", 5: "Competing in",
};

function art(activity: { application_id?: string; assets?: { large_image?: string } } | undefined) {
  const image = activity?.assets?.large_image;
  if (!image || image.startsWith("spotify:")) return null;
  if (image.startsWith("mp:")) return `https://media.discordapp.net/${image.slice(3)}`;
  return activity?.application_id
    ? `https://cdn.discordapp.com/app-assets/${activity.application_id}/${image}.png?size=256`
    : null;
}

function cdn(kind: string, id: string, hash?: string | null, size = 512) {
  if (!hash) return null;
  return `https://cdn.discordapp.com/${kind}/${id}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=${size}`;
}

function person(payload: { data?: Record<string, unknown> } | null, fallback: Founder): Founder {
  const data = payload?.data as {
    discord_status?: string;
    discord_user?: { id: string; username: string; global_name?: string | null; avatar?: string | null; primary_guild?: { tag?: string | null } | null };
    activities?: { type: number; name: string; details?: string | null; state?: string | null; application_id?: string; assets?: { large_image?: string } }[];
    listening_to_spotify?: boolean;
    spotify?: { song?: string; artist?: string; album?: string; album_art_url?: string } | null;
    active_on_discord_mobile?: boolean;
    active_on_discord_web?: boolean;
    active_on_discord_desktop?: boolean;
  } | undefined;
  if (!data?.discord_user) return fallback;
  const user = data.discord_user;
  const spotify = data.listening_to_spotify ? data.spotify : null;
  const activity = (data.activities ?? []).find((item) => item.type !== 4);
  return {
    id: user.id,
    name: user.global_name || user.username,
    username: user.username,
    avatar: cdn("avatars", user.id, user.avatar),
    tag: user.primary_guild?.tag ?? "YVL",
    status: data.discord_status ?? "offline",
    platform: data.active_on_discord_mobile ? "mobile" : data.active_on_discord_web ? "web" : data.active_on_discord_desktop ? "desktop" : null,
    now: spotify
      ? { verb: "Listening to", title: spotify.song ?? "Spotify", detail: [spotify.artist, spotify.album].filter(Boolean).join(" · "), image: spotify.album_art_url ?? null }
      : activity
        ? { verb: VERB[activity.type] ?? "Doing", title: activity.name, detail: activity.details || activity.state || "", image: art(activity) }
        : null,
  };
}

function toLive(first: { data?: Record<string, unknown> } | null, second: { data?: Record<string, unknown> } | null, invite: { guild?: { id?: string; name?: string; icon?: string; banner?: string; description?: string | null }; profile?: { description?: string | null; member_count?: number; online_count?: number; premium_subscription_count?: number; tag?: string }; approximate_member_count?: number; approximate_presence_count?: number } | null): Live {
  const guildId = invite?.guild?.id ?? "1499154102519861421";
  return {
    founders: [person(first, FALLBACK.founders[0]!), person(second, FALLBACK.founders[1]!)],
    guild: {
      name: invite?.guild?.name ?? FALLBACK.guild.name,
      description: invite?.profile?.description || invite?.guild?.description || FALLBACK.guild.description,
      icon: cdn("icons", guildId, invite?.guild?.icon, 256),
      banner: cdn("banners", guildId, invite?.guild?.banner, 1024),
      members: invite?.profile?.member_count ?? invite?.approximate_member_count ?? null,
      online: invite?.profile?.online_count ?? invite?.approximate_presence_count ?? null,
      boosts: invite?.profile?.premium_subscription_count ?? null,
      tag: invite?.profile?.tag ?? "YVL",
      invite: "https://discord.gg/yvl",
    },
  };
}

function FounderCard({ person, progress }: { person: Founder; progress: number }) {
  return (
    <figure
      className="founder"
      style={{ transform: `translateY(${(1 - progress) * 28}px)`, opacity: progress }}
    >
      <div className="avatar">
        {person.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatar} alt="" />
        ) : (
          <span>{person.name.slice(0, 1)}</span>
        )}
        <i className={`status-${person.status}`} />
      </div>
      <figcaption>
        <small>Founder</small>
        <strong>{person.name}</strong>
        <em>@{person.username}</em>
        <span className="chips">
          <b className={`dot status-${person.status}`} />
          {person.status}
          {person.platform ? ` · ${person.platform}` : ""}
        </span>
      </figcaption>
      <div className="now-line">
        {person.now?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.now.image} alt="" />
        ) : (
          <span className="quiet-mark" />
        )}
        <p>
          <span>{person.now ? person.now.verb : "Quiet"}</span>
          {person.now?.title ?? "Nothing playing"}
          {person.now?.detail ? <small>{person.now.detail}</small> : null}
        </p>
      </div>
    </figure>
  );
}

export function Reel() {
  const track = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [houseFill, setHouseFill] = useState(0);
  const [live, setLive] = useState<Live>(FALLBACK);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const [first, second, invite] = await Promise.all([
          fetch("https://api.lanyard.rest/v1/users/711086947170385970", { cache: "no-store" }).then((item) => item.ok ? item.json() : null).catch(() => null),
          fetch("https://api.lanyard.rest/v1/users/719868014358560810", { cache: "no-store" }).then((item) => item.ok ? item.json() : null).catch(() => null),
          fetch("https://discord.com/api/v10/invites/yvl?with_counts=true", { cache: "no-store" }).then((item) => item.ok ? item.json() : null).catch(() => null),
        ]);
        if (stop) return;
        const next = toLive(first, second, invite);
        setLive((current) => ({
          founders: next.founders.map((person, index) =>
            person.avatar || person.username ? person : current.founders[index] ?? person
          ),
          guild: next.guild.members != null ? next.guild : current.guild,
        }));
      } catch {
        /* keep the last good frame */
      }
    };
    void load();
    const timer = window.setInterval(load, 12000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const node = track.current;
    if (!node || reduced) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const scenes = [...node.querySelectorAll<HTMLElement>("[data-scene]")];
      const view = window.innerHeight;
      const values = scenes.map((scene) => {
        const rect = scene.getBoundingClientRect();
        const center = clamp(1 - Math.abs(rect.top + rect.height / 2 - view / 2) / view);
        const travel = clamp((view - rect.top) / (view + rect.height));
        scene.dataset.travel = travel.toFixed(3);
        return center;
      });
      const house = scenes.find((scene) => scene.classList.contains("shot-house"));
      if (house) {
        const top = house.getBoundingClientRect().top;
        setHouseFill(clamp((view - top) / (view * 0.8)));
      }
      setProgress(values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
      scenes.forEach((scene, index) => {
        scene.style.setProperty("--reveal", values[index]?.toFixed(3) ?? "0");
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const measure = () => {
      frame = requestAnimationFrame(measure);
      const view = window.innerHeight || 1;
      const house = document.querySelector<HTMLElement>(".shot-house");
      const top = house ? house.getBoundingClientRect().top : view;
      const fill = clamp(1 - top / view);
      document.querySelectorAll<HTMLElement>("[data-count]").forEach((node) => {
        const target = Number(node.dataset.count);
        const order = Number(node.dataset.order || 0);
        const local = clamp((fill - order * 0.12) / 0.5);
        if (Number.isFinite(target)) node.textContent = format(Math.round(target * local));
        const bar = node.parentElement?.querySelector<HTMLElement>("[data-bar]");
        if (bar) bar.style.transform = `scaleX(${local})`;
      });
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
    };
  }, [reduced]);

  const scene = progress < 0.5 ? 1 : 2;
  const [left, right] = live.founders;

  return (
    <section className={reduced ? "reel is-stacked" : "reel"} ref={track} aria-label="Founders">
      <div className="reel-pin">
        <div className="grain" aria-hidden="true" />
        <div className="wash" aria-hidden="true" />
        <div className="reel-meta" lang="en">
          <span>0{scene}</span>
          <i />
          <span>02</span>
        </div>

        <article className="shot shot-founders" data-scene>
          <p className="shot-kicker">Founders</p>
          <div className="pair">
            {left ? <FounderCard person={left} progress={1} /> : null}
            {right ? <FounderCard person={right} progress={1} /> : null}
          </div>
        </article>

        <article className="shot shot-house" data-scene>
          {live.guild.banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="house-banner"
              src={live.guild.banner}
              alt=""
              style={{ transform: "scale(1.08)" }}
            />
          ) : null}
          <div className="house-shade" />
          <div className="house">
            <p className="shot-kicker">The house</p>
            <div className="house-mark">
              {live.guild.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={live.guild.icon} alt="" />
              ) : (
                <span>Y</span>
              )}
            </div>
            <h2>{live.guild.name}</h2>
            <p className="detail">{live.guild.description}</p>
            <dl>
              {(
                [
                  ["Members", live.guild.members],
                  ["Online", live.guild.online],
                  ["Boosts", live.guild.boosts],
                ] as const
              ).map(([label, value], index) => (
 <div key={label}>
 <dt>{label}</dt>
 <dd>
                  <b>{format(value == null ? null : Math.round(value * clamp((houseFill - index * 0.1) / 0.55)))}</b>
                </dd>
 <span data-bar="" />
 </div>
 ))}
            </dl>
            <a
              href={live.guild.invite}
              target="_blank"
              rel="noopener noreferrer"
              style={undefined}
            >
              discord.gg/yvl
            </a>
          </div>
        </article>
      </div>

      <section className="invite" aria-label="Join the server">
        <p>The official server</p>
        <h2>Come in.</h2>
        <a href="https://discord.gg/yvl" target="_blank" rel="noopener noreferrer">
          Join discord.gg/yvl
        </a>
      </section>
    </section>
  );
}
