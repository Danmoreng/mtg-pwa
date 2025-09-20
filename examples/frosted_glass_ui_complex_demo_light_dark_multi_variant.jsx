import React, { useEffect, useMemo, useState } from "react";

// Complex Frosted Glass (Glassmorphism) UI Demo
// - Multiple component variants: navbars, cards, buttons, dropdowns, modals
// - Multiple layout variants: Dashboard, Landing, Grid Gallery, Kitchen Sink
// - Light/Dark mode, accent colors, blur/noise controls
// - TailwindCSS for utility styling; custom CSS classes for glass effects
// - All in one file for easy copy/paste

export default function FrostedGlassDemo() {
  // Theme state
  const [dark, setDark] = useState(true);
  const [accent, setAccent] = useState({ h: 265, s: 92, l: 60, name: "Iris" });
  const [blur, setBlur] = useState(14);
  const [noise, setNoise] = useState(true);
  const [saturation, setSaturation] = useState(120);
  const [contrast, setContrast] = useState(110);
  const [layout, setLayout] = useState("dashboard");
  const [openModal, setOpenModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);

  const accents = [
    { h: 265, s: 92, l: 60, name: "Iris" },
    { h: 205, s: 90, l: 60, name: "Azure" },
    { h: 150, s: 85, l: 50, name: "Mint" },
    { h: 25, s: 95, l: 56, name: "Tangerine" },
    { h: 345, s: 85, l: 60, name: "Rose" },
    { h: 45, s: 95, l: 55, name: "Gold" },
  ];

  const cssVars = useMemo(() => {
    const accentStr = `${accent.h} ${accent.s}% ${accent.l}%`;
    const bgImgLight = `radial-gradient(60% 60% at 20% 10%, hsla(${accent.h}, ${accent.s}%, ${Math.min(
      90,
      accent.l + 25
    )}%, 0.35) 0px, transparent 50%), radial-gradient(80% 80% at 90% 20%, hsla(${accent.h}, ${accent.s}%, ${
      accent.l
    }%, 0.15) 0px, transparent 50%)`;
    const bgImgDark = `radial-gradient(60% 60% at 20% 10%, hsla(${accent.h}, ${accent.s}%, ${Math.min(
      60,
      accent.l
    )}%, 0.25) 0px, transparent 50%), radial-gradient(90% 90% at 90% 20%, hsla(${accent.h}, ${accent.s}%, ${
      accent.l
    }%, 0.12) 0px, transparent 55%)`;
    return {
      "--accent": accentStr,
      "--blur": `${blur}px`,
      "--sat": `${saturation}%`,
      "--con": `${contrast}%`,
      "--glass-bg": "255 255 255 / 0.65",
      "--glass-bg-strong": "255 255 255 / 0.9",
      "--glass-bg-soft": "255 255 255 / 0.4",
      "--glass-bg-dark": "10 10 12 / 0.55",
      "--glass-bg-dark-strong": "15 15 18 / 0.8",
      "--glass-bg-dark-soft": "15 15 18 / 0.35",
      "--bg-img-light": bgImgLight,
      "--bg-img-dark": bgImgDark,
    };
  }, [accent, blur, saturation, contrast]);

  useEffect(() => {
    const close = (e) => {
      const target = e.target;
      if (target instanceof Element) {
        if (!target.closest("#dropdownButton") && !target.closest("#dropdownPanel")) {
          setOpenDropdown(false);
        }
      }
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  return (
    <div className={dark ? "dark" : ""}>
      <style>{globalCSS}</style>
      <div
        style={cssVars}
        className="relative min-h-screen w-full overflow-x-hidden bg-fixed transition-colors duration-300"
      >
        <div
          className="pointer-events-none fixed inset-0 -z-50"
          style={{
            backgroundImage: dark ? "var(--bg-img-dark)" : "var(--bg-img-light)",
            backgroundColor: dark ? "#070709" : "#f4f6fb",
          }}
        />
        {noise && <div className="noise-overlay" aria-hidden="true" />}

        <header className="sticky top-0 z-40">
          <div className="mx-auto flex max-w-7xl items-center gap-3 p-3">
            <GlassBar variant="minimal">
              <div className="flex items-center gap-3">
                <Logo />
                <span className="text-sm font-medium opacity-80">Frosted Glass UI</span>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <NavPill>Overview</NavPill>
                <NavPill>Docs</NavPill>
                <NavPill>Playground</NavPill>
                <NavPill>Changelog</NavPill>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn glass-accent"
                  onClick={() => setOpenModal(true)}
                  title="Open modal"
                >
                  <SparkleIcon className="mr-1 h-4 w-4" />
                  Try modal
                </button>
                <div className="relative">
                  <button id="dropdownButton" className="btn glass" onClick={() => setOpenDropdown((v) => !v)}>
                    <ChevronDownIcon className="mr-1 h-4 w-4" />
                    Menu
                  </button>
                  {openDropdown && (
                    <div
                      id="dropdownPanel"
                      className="glass-panel absolute right-0 mt-2 w-56 rounded-2xl p-2"
                    >
                      <DropdownItem onClick={() => setLayout("dashboard")}>Dashboard layout</DropdownItem>
                      <DropdownItem onClick={() => setLayout("landing")}>Landing layout</DropdownItem>
                      <DropdownItem onClick={() => setLayout("grid")}>Cards grid</DropdownItem>
                      <DropdownItem onClick={() => setLayout("kitchen")}>Kitchen sink</DropdownItem>
                      <div className="my-2 h-px bg-white/10 dark:bg-black/20" />
                      <DropdownItem onClick={() => setDark((d) => !d)}>
                        {dark ? <SunIcon className="mr-2 h-4 w-4" /> : <MoonIcon className="mr-2 h-4 w-4" />}
                        Toggle theme
                      </DropdownItem>
                    </div>
                  )}
                </div>
                <button
                  className="icon-btn glass"
                  onClick={() => setDark((d) => !d)}
                  aria-label="Toggle theme"
                >
                  {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                </button>
              </div>
            </GlassBar>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-3 pb-6 pt-4 md:grid-cols-12">
          <div className="md:col-span-9">
            <GlassBar variant="elevated" className="p-2">
              <SegmentedControl
                value={layout}
                onChange={setLayout}
                options={[
                  { value: "dashboard", label: "Dashboard" },
                  { value: "landing", label: "Landing" },
                  { value: "grid", label: "Cards Grid" },
                  { value: "kitchen", label: "Kitchen Sink" },
                ]}
              />
            </GlassBar>
          </div>
          <div className="md:col-span-3">
            <GlassBar variant="elevated" className="p-2">
              <div className="flex items-center gap-2">
                <PaletteIcon className="h-4 w-4 opacity-70" />
                <span className="text-sm opacity-80">Accents</span>
              </div>
              <div className="mt-2 grid grid-cols-6 gap-2">
                {accents.map((a) => (
                  <button
                    key={a.name}
                    className={`aspect-square rounded-xl ring-1 ring-black/5 transition hover:scale-105 dark:ring-white/10 ${
                      accent.name === a.name ? "ring-2 ring-[hsl(var(--accent))]" : ""
                    }`}
                    style={{ backgroundColor: `hsl(${a.h} ${a.s}% ${a.l}%)` }}
                    onClick={() => setAccent(a)}
                    title={a.name}
                  />
                ))}
              </div>
            </GlassBar>
          </div>
        </section>

        <main className="mx-auto max-w-7xl px-3 pb-16">
          {layout === "dashboard" && <DashboardDemo />}
          {layout === "landing" && <LandingDemo />}
          {layout === "grid" && <GridDemo />}
          {layout === "kitchen" && <KitchenSink setOpenModal={setOpenModal} />}
        </main>

        <aside className="fixed bottom-4 right-4 z-50 w-80 max-w-[92vw]">
          <GlassBar variant="gradient" className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersIcon className="h-4 w-4 opacity-70" />
                <span className="text-sm font-medium opacity-80">Glass Controls</span>
              </div>
              <span className="rounded-full bg-[hsl(var(--accent))]/20 px-2 py-0.5 text-xs font-medium text-[hsl(var(--accent))]">
                {accent.name}
              </span>
            </div>
            <div className="mt-3 space-y-3 text-sm">
              <LabeledRange label={`Blur: ${blur}px`} min={6} max={32} step={1} value={blur} onChange={setBlur} />
              <LabeledRange label={`Saturation: ${saturation}%`} min={80} max={180} step={5} value={saturation} onChange={setSaturation} />
              <LabeledRange label={`Contrast: ${contrast}%`} min={90} max={150} step={5} value={contrast} onChange={setContrast} />
              <div className="flex items-center justify-between">
                <span>Noise</span>
                <Switch checked={noise} onChange={setNoise} />
              </div>
            </div>
          </GlassBar>
        </aside>

        {openModal && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpenModal(false)} />
            <div className="glass-panel relative w-full max-w-lg rounded-3xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Frosted Modal</h3>
                  <p className="mt-1 text-sm opacity-80">
                    This modal uses the <code>.glass-panel</code> class with accent border glow. It sits on top of a softly
                    blurred overlay. Tweak blur/contrast to see it adapt.
                  </p>
                </div>
                <button className="icon-btn glass" onClick={() => setOpenModal(false)} aria-label="Close modal">
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="btn glass">Secondary</button>
                <button className="btn glass-accent">Primary</button>
              </div>
            </div>
          </div>
        )}

        <footer className="mx-auto mt-8 max-w-7xl px-3 pb-10">
          <div className="glass-pane flex items-center justify-between rounded-2xl p-4 text-xs">
            <span className="opacity-70">Built with React + Tailwind. Tweak the controls to generate variants.</span>
            <span className="opacity-70">Light/Dark • Accent • Blur • Noise • Saturation • Contrast</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function DashboardDemo() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <div className="md:col-span-3 space-y-4">
        <GlassCard>
          <h3 className="card-title">Sidebar</h3>
          <div className="mt-3 space-y-2 text-sm">
            <NavItem active>Overview</NavItem>
            <NavItem>Projects</NavItem>
            <NavItem>Team</NavItem>
            <NavItem>Billing</NavItem>
            <NavItem>Settings</NavItem>
          </div>
        </GlassCard>
        <GlassCard variant="soft">
          <h3 className="card-title">Quick Actions</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn glass"><PlusIcon className="mr-1 h-4 w-4"/>New</button>
            <button className="btn glass">Share</button>
            <button className="btn glass">Import</button>
            <button className="btn glass">Export</button>
          </div>
        </GlassCard>
      </div>

      <div className="md:col-span-9 space-y-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <h3 className="card-title">KPIs</h3>
            <div className="flex items-center gap-2"><button className="btn glass">Refresh</button><button className="btn glass-accent">Run</button></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Revenue" value="$82.4k" delta="12%" />
            <Stat label="Active Users" value="18.2k" delta="5%" />
            <Stat label="NPS" value="52" delta="+3" />
            <Stat label="Tickets" value="241" delta="-8%" />
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <GlassCard variant="pane">
            <h3 className="card-title">Recent Activity</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                "Invited Maria to Project Apollo",
                "Updated pricing card visuals",
                "Replied to 4 support tickets",
                "Pushed build #1487 to production",
              ].map((t, i) => (
                <li key={i} className="glass-row">
                  <DotIcon className="h-4 w-4" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard variant="pane">
            <h3 className="card-title">Team</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {"ABCD".split("").map((l, i) => (
                <Profile key={i} name={`Member ${l}`} role={i % 2 ? "Designer" : "Engineer"} />
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function LandingDemo() {
  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div className="absolute inset-0 -z-10 opacity-60">
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-[hsl(var(--accent))]/25 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-[hsl(var(--accent))]/20 blur-3xl" />
      </div>
      <div className="glass-hero rounded-3xl p-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
          Elegant <span className="text-[hsl(var(--accent))]">Frosted</span> Interfaces
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-balance text-sm opacity-80 md:text-base">
          Professional, accessible glassmorphism components. Light & dark aware, accentable, and fully responsive.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button className="btn glass-accent"><SparkleIcon className="mr-1 h-4 w-4"/>Get Started</button>
          <button className="btn glass">Live Demo</button>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <GlassCard>
          <h3 className="card-title">Pixel-Perfect</h3>
          <p className="mt-2 text-sm opacity-80">Crisp borders, subtle highlights, and realistic depth.
          </p>
        </GlassCard>
        <GlassCard>
          <h3 className="card-title">Adaptive</h3>
          <p className="mt-2 text-sm opacity-80">Dark/light aware materials with live accent coloring.
          </p>
        </GlassCard>
        <GlassCard>
          <h3 className="card-title">Composable</h3>
          <p className="mt-2 text-sm opacity-80">Use the base glass classes to build anything.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

function GridDemo() {
  const variants = [
    { name: "Card", className: "glass-card" },
    { name: "Pane", className: "glass-pane" },
    { name: "Panel", className: "glass-panel" },
    { name: "Soft", className: "glass-soft" },
    { name: "Strong", className: "glass-strong" },
    { name: "Ultra", className: "glass-ultra" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
      {variants.map((v) => (
        <div key={v.name} className={`${v.className} group aspect-square rounded-2xl p-3`}>
          <div className="flex h-full w-full items-center justify-center rounded-xl border border-white/60 border-t-white/90 bg-gradient-to-b from-white/40 to-white/20 text-xs text-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-[var(--blur)] saturate-[var(--sat)] contrast-[var(--con)] dark:border-white/10 dark:border-t-white/20 dark:from-white/10 dark:to-white/5 dark:text-white/80">
            {v.name}
          </div>
        </div>
      ))}
    </div>
  );
}

function KitchenSink({ setOpenModal }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <div className="md:col-span-8 space-y-4">
        <GlassCard>
          <h3 className="card-title">Buttons</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn glass">Default</button>
            <button className="btn glass-accent">Primary</button>
            <button className="btn glass-strong">Strong</button>
            <button className="btn glass-soft">Soft</button>
            <button className="btn glass outline">Outline</button>
            <button className="btn glass" disabled>Disabled</button>
            <button className="btn glass" onClick={() => setOpenModal(true)}>
              <SparkleIcon className="mr-1 h-4 w-4"/>Open Modal
            </button>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="card-title">Form</h3>
          <form className="mt-3 grid grid-cols-2 gap-3">
            <label className="field">
              <span>Name</span>
              <input className="input glass" placeholder="Jane Doe" />
            </label>
            <label className="field">
              <span>Email</span>
              <input className="input glass" placeholder="jane@example.com" />
            </label>
            <label className="field col-span-2">
              <span>Message</span>
              <textarea className="input glass h-24" placeholder="Say hello..." />
            </label>
            <div className="col-span-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm opacity-80">
                <input type="checkbox" className="checkbox" />
                Subscribe to newsletter
              </label>
              <button className="btn glass-accent">Send</button>
            </div>
          </form>
        </GlassCard>

        <GlassCard>
          <h3 className="card-title">Table</h3>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/50 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="glass-pane">
                <tr>
                  {"Name Role Status".split(" ").map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="odd:bg-white/20 even:bg-white/10 dark:odd:bg-white/5 dark:even:bg-white/0">
                    <td className="px-3 py-2">User {i}</td>
                    <td className="px-3 py-2">{i % 2 ? "Designer" : "Engineer"}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill">{i % 2 ? "Active" : "Paused"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      <div className="md:col-span-4 space-y-4">
        <GlassCard variant="pane">
          <h3 className="card-title">Tabs</h3>
          <Tabs tabs={["Design", "Code", "Preview"]}>
            <div className="text-sm opacity-80">Design guidelines for consistent glass depth and spacing.</div>
            <div className="text-xs opacity-80">CSS utility classes for glass effects: .glass, .glass-card, .glass-panel…</div>
            <div className="text-sm opacity-80">Live preview updates with controls on the right.</div>
          </Tabs>
        </GlassCard>

        <GlassCard variant="soft">
          <h3 className="card-title">Badges</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {"New Stable Beta Deprecated Experimental".split(" ").map((b) => (
              <span key={b} className="badge glass-pane">{b}</span>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="card-title">Notifications</h3>
          <div className="mt-2 space-y-2 text-sm">
            <div className="glass-row">
              <InfoIcon className="h-4 w-4" />
              <span>Your workspace has been upgraded.</span>
            </div>
            <div className="glass-row">
              <AlertIcon className="h-4 w-4" />
              <span>Payment failed on invoice #1021.</span>
            </div>
            <div className="glass-row">
              <CheckIcon className="h-4 w-4" />
              <span>Backup completed successfully.</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function GlassBar({ children, variant = "minimal", className = "" }) {
  const base = "glass-pane rounded-2xl border-t border-white/70 dark:border-white/20";
  const variants = {
    minimal: base,
    elevated: base + " shadow-lg shadow-black/5 dark:shadow-black/20",
    gradient: base + " from-white/50 to-white/30 bg-gradient-to-r dark:from-white/10 dark:to-white/5",
  };
  return <div className={`${variants[variant]} ${className}`}>{children}</div>;
}

function GlassCard({ children, variant = "card" }) {
  const base = "rounded-3xl p-4";
  const map = {
    card: "glass-card",
    soft: "glass-soft",
    strong: "glass-strong",
    ultra: "glass-ultra",
    pane: "glass-pane",
  };
  return <div className={`${map[variant]} ${base}`}>{children}</div>;
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="glass-pane inline-flex rounded-xl p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1 transition ${
            value === o.value ? "bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]" : "hover:bg-white/30 dark:hover:bg-white/10"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LabeledRange({ label, min, max, step, value, onChange }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs opacity-70">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="range"
      />
    </label>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button
      className={`relative h-6 w-11 rounded-full border transition ${
        checked ? "bg-[hsl(var(--accent))]/40 border-[hsl(var(--accent))]/40" : "bg-white/30 border-white/60 dark:bg-white/10 dark:border-white/20"
      }`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-white/80 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Tabs({ tabs, children }) {
  const kids = Array.isArray(children) ? children : [children];
  const [idx, setIdx] = useState(0);
  return (
    <div>
      <div className="glass-pane inline-flex rounded-xl p-1 text-sm">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setIdx(i)}
            className={`rounded-lg px-3 py-1 transition ${
              i === idx ? "bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]" : "hover:bg-white/30 dark:hover:bg-white/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-3">{kids[idx]}</div>
    </div>
  );
}

function Profile({ name, role }) {
  return (
    <div className="glass-card flex items-center gap-3 rounded-2xl p-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--accent))]/25 text-sm font-semibold text-[hsl(var(--accent))]">
        {name.slice(0, 2)}
      </div>
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs opacity-70">{role}</div>
      </div>
      <button className="ml-auto btn glass">View</button>
    </div>
  );
}

function Stat({ label, value, delta }) {
  return (
    <div className="glass-pane rounded-2xl p-3">
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-xl font-semibold">{value}</div>
        <div className="text-xs text-[hsl(var(--accent))]">{delta}</div>
      </div>
    </div>
  );
}

function NavItem({ children, active = false }) {
  return (
    <button
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
        active ? "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]" : "hover:bg-white/40 dark:hover:bg-white/10"
      }`}
    >
      <span>{children}</span>
      {active && <span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />}
    </button>
  );
}

function NavPill({ children }) {
  return (
    <button className="rounded-xl px-3 py-1.5 text-sm opacity-80 transition hover:opacity-100 hover:bg-white/40 dark:hover:bg-white/10">
      {children}
    </button>
  );
}

function DropdownItem({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm hover:bg-white/40 dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function SunIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
  );
}
function MoonIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  );
}
function PaletteIcon(props){return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-1.1.9-2 2-2h1a3 3 0 0 0 0-6h-1a2 2 0 0 1-2-2c0-3-2-6-4-6z"/></svg>)}
function SlidersIcon(props){return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M3 6h18M3 18h18M6 6v6m12 0v6"/></svg>)}
function SparkleIcon(props){return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M12 2l2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5z"/></svg>)}
function ChevronDownIcon(props){return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M6 9l6 6 6-6"/></svg>)}
function XIcon(props){return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M18 6L6 18M6 6l12 12"/></svg>)}
function DotIcon(props){return (<svg viewBox="0 0 24 24" fill="currentColor" {...props}><circle cx="12" cy="12" r="3"/></svg>)}
function PlusIcon(props){return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M12 5v14M5 12h14"/></svg>)}
function InfoIcon(props){return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>)}
function AlertIcon(props){return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>)}
function CheckIcon(props){return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M20 6L9 17l-5-5"/></svg>)}

function Logo(){
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-xl bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] shadow-inner shadow-white/40">FG</span>
    </div>
  );
}

const globalCSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; }
body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; }

.noise-overlay { position: fixed; inset: 0; pointer-events: none; z-index: -40; opacity: 0.25; mix-blend-mode: soft-light; background-image: url('data:image/svg+xml;utf8,\
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">\
<filter id="n" x="0" y="0">\
  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>\
  <feColorMatrix type="saturate" values="0"/>\
</filter>\
<rect width="100%" height="100%" filter="url(%23n)" opacity="0.9"/>\
</svg>'); }

:root { --accent: 260 92% 60%; --blur: 14px; --sat: 120%; --con: 110%; }

.glass, .glass-card, .glass-pane, .glass-panel, .glass-soft, .glass-strong, .glass-ultra, .glass-hero {
  backdrop-filter: blur(var(--blur)) saturate(var(--sat)) contrast(var(--con));
  -webkit-backdrop-filter: blur(var(--blur)) saturate(var(--sat)) contrast(var(--con));
}

.glass-card { background: rgb(var(--glass-bg)); border: 1px solid rgba(255,255,255,0.55); box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 24px rgba(0,0,0,0.06); }
.glass-pane { background: rgb(var(--glass-bg-soft)); border: 1px solid rgba(255,255,255,0.45); box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 6px 18px rgba(0,0,0,0.05); }
.glass-panel { background: rgb(var(--glass-bg-strong)); border: 1px solid rgba(255,255,255,0.75); box-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 10px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.2) inset, 0 0 0 1px rgba(255,255,255,0.1);
  position: relative; }
.glass-soft { background: rgb(var(--glass-bg-soft)); border: 1px solid rgba(255,255,255,0.35); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 16px rgba(0,0,0,0.04); }
.glass-strong { background: rgb(var(--glass-bg-strong)); border: 1px solid rgba(255,255,255,0.85); box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 14px 40px rgba(0,0,0,0.1); }
.glass-ultra { background: rgba(255,255,255,0.98); border: 1px solid rgba(255,255,255,0.95); box-shadow: 0 16px 60px rgba(0,0,0,0.15); }
.glass-hero { background: linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0.45)); border: 1px solid rgba(255,255,255,0.7); box-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 14px 40px rgba(0,0,0,0.08); }

.dark .glass-card { background: rgb(var(--glass-bg-dark)); border-color: rgba(255,255,255,0.12); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.4); }
.dark .glass-pane { background: rgb(var(--glass-bg-dark-soft)); border-color: rgba(255,255,255,0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 18px rgba(0,0,0,0.35); }
.dark .glass-panel { background: rgb(var(--glass-bg-dark-strong)); border-color: rgba(255,255,255,0.18); box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 30px rgba(0,0,0,0.5); }
.dark .glass-soft { background: rgb(var(--glass-bg-dark-soft)); border-color: rgba(255,255,255,0.06); }
.dark .glass-strong { background: rgb(var(--glass-bg-dark-strong)); border-color: rgba(255,255,255,0.2); }
.dark .glass-hero { background: linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0.08)); border-color: rgba(255,255,255,0.12); }

.glass-panel::after { content: ""; position: absolute; inset: -1.5px; border-radius: 1.5rem; pointer-events: none; background: linear-gradient(120deg, transparent 20%, hsla(var(--accent),0.3), transparent 80%); mask: linear-gradient(#000,#000) content-box, linear-gradient(#000,#000); -webkit-mask-composite: xor; mask-composite: exclude; padding: 1.5px; }

.btn { height: 2.25rem; padding: 0 0.9rem; font-size: 0.9rem; border-radius: 0.9rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; transition: transform .15s ease, box-shadow .15s ease, background .15s ease; border: 1px solid rgba(255,255,255,0.5); }
.btn.glass { background: rgba(255,255,255,0.5); box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px rgba(0,0,0,0.06); }
.btn.glass:hover { transform: translateY(-1px); }
.btn.glass-accent { background: hsla(var(--accent), 0.2); color: hsl(var(--accent)); border-color: hsla(var(--accent),0.5); box-shadow: 0 8px 22px hsla(var(--accent),0.25), inset 0 1px 0 rgba(255,255,255,0.6); }
.btn.glass-strong { background: rgba(255,255,255,0.85); }
.btn.glass-soft { background: rgba(255,255,255,0.35); }
.btn.outline { background: transparent; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.dark .btn.glass { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.15); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 16px rgba(0,0,0,0.3); }
.dark .btn.glass:hover { box-shadow: 0 10px 30px rgba(0,0,0,0.45); }
.dark .btn.glass-strong { background: rgba(255,255,255,0.18); }
.dark .btn.glass-soft { background: rgba(255,255,255,0.08); }

.icon-btn { height: 2.25rem; width: 2.25rem; display: inline-grid; place-items: center; border-radius: 0.8rem; border: 1px solid rgba(255,255,255,0.5); background: rgba(255,255,255,0.5); box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px rgba(0,0,0,0.06); }
.dark .icon-btn { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.12); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 16px rgba(0,0,0,0.35); }

.field { display: grid; gap: .35rem; font-size: .85rem; }
.input { width: 100%; padding: .65rem .8rem; border-radius: .9rem; border: 1px solid rgba(255,255,255,0.6); background: rgba(255,255,255,0.5); box-shadow: inset 0 1px 0 rgba(255,255,255,0.65); }
.input:focus { outline: none; box-shadow: 0 0 0 4px hsla(var(--accent),0.25); }
.dark .input { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); color: white; }
.checkbox { width: 1rem; height: 1rem; accent-color: hsl(var(--accent)); }
.range { appearance: none; height: 6px; width: 100%; border-radius: 999px; background: linear-gradient(90deg, hsla(var(--accent),0.6), rgba(255,255,255,0.5)); outline: none; }
.range::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; border-radius: 50%; background: white; border: 2px solid hsla(var(--accent),0.8); box-shadow: 0 2px 10px hsla(var(--accent),0.35); }

.card-title { font-size: 0.95rem; font-weight: 600; letter-spacing: 0.2px; }
.badge { display: inline-flex; align-items: center; height: 1.6rem; padding: 0 .6rem; border-radius: .7rem; font-weight: 500; border: 1px solid rgba(255,255,255,0.6); }
.status-pill { display: inline-flex; align-items: center; gap: .35rem; padding: .15rem .45rem; border-radius: .6rem; font-size: .7rem; background: hsla(var(--accent),0.2); color: hsl(var(--accent)); border: 1px solid hsla(var(--accent),0.4); }
.glass-row { display: flex; align-items: center; gap: .6rem; padding: .55rem .7rem; border-radius: .9rem; background: rgba(255,255,255,0.45); border: 1px solid rgba(255,255,255,0.5); }
.dark .glass-row { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.12); }

:root { --glass-bg: 255 255 255 / 0.6; --glass-bg-soft: 255 255 255 / 0.35; --glass-bg-strong: 255 255 255 / 0.85; }
.dark { color-scheme: dark; --glass-bg: var(--glass-bg-dark); --glass-bg-soft: var(--glass-bg-dark-soft); --glass-bg-strong: var(--glass-bg-dark-strong); }

body { color: #0f1222; }
.dark { color: #f2f3f7; }
`;
