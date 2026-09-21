import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GitBranch,
  Users,
  Share2,
  Layers,
  ShieldCheck,
  ArrowRight,
  Lock,
  Heart,
  Calendar,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

/* ─── Interactive 3D Family Tree ──────────────────────────────────────────── */
function InteractiveFamilyTree3D() {
  const containerRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 8, ry: -12, scale: 1 });
  const [isHovered, setIsHovered] = useState(false);
  const animFrameRef = useRef(null);

  // Smooth ambient float when not hovered
  useEffect(() => {
    let start = null;

    function ambientLoop(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;

      if (!isHovered) {
        // Gentle organic 3D swaying rotation
        const rx = 6 + Math.sin(elapsed / 1800) * 4;
        const ry = -10 + Math.cos(elapsed / 2200) * 6;
        setTilt({ rx, ry, scale: 1 });
      }

      animFrameRef.current = requestAnimationFrame(ambientLoop);
    }

    animFrameRef.current = requestAnimationFrame(ambientLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isHovered]);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const px = (x / rect.width) * 2 - 1; // -1 to 1
    const py = (y / rect.height) * 2 - 1; // -1 to 1

    // Convert mouse position to 3D rotation angles
    const rx = -py * 16;
    const ry = px * 20;
    setTilt({ rx, ry, scale: 1.02 });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-[540px] h-[450px] sm:h-[520px] select-none cursor-grab active:cursor-grabbing flex items-center justify-center scale-[0.72] xxs:scale-[0.82] xs:scale-[0.9] sm:scale-100 origin-center my-[-30px] sm:my-0"
      style={{ perspective: "1200px" }}
    >
      {/* Dynamic 3D Scene Root */}
      <div
        className="relative w-full h-full transition-transform ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.scale})`,
          transitionDuration: isHovered ? "120ms" : "800ms",
        }}
      >
        {/* Layer 0: 3D Ground Plane / Ancestry Rings */}
        <div
          className="absolute inset-x-8 inset-y-10 rounded-3xl pointer-events-none"
          style={{
            transform: "translateZ(-70px)",
            background:
              "radial-gradient(circle at 50% 50%, rgba(28,75,60,0.07) 0%, rgba(201,164,104,0.04) 45%, transparent 75%)",
            border: "1px dashed rgba(201,190,168,0.4)",
          }}
        >
          {/* Subtle concentric generational orbit rings */}
          <div className="absolute inset-10 rounded-full border border-[#C9BEA8]/20" />
          <div className="absolute inset-24 rounded-full border border-[#C9BEA8]/30" />
          <div className="absolute inset-36 rounded-full border border-[#1C4B3C]/15" />
        </div>

        {/* 3D SVG Connector Lines in Depth */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: "translateZ(0px)", transformStyle: "preserve-3d" }}
          viewBox="0 0 540 520"
        >
          <defs>
            <linearGradient id="treeBranchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#C9A468" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#2B6E57" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1C4B3C" stopOpacity="0.9" />
            </linearGradient>
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Lines from Great-grandparents to Grandparents */}
          <path
            d="M 150 95 C 150 130, 200 135, 200 165"
            fill="none"
            stroke="url(#treeBranchGrad)"
            strokeWidth="1.75"
            strokeDasharray="4 3"
            opacity="0.65"
          />
          <path
            d="M 270 95 C 270 130, 220 135, 220 165"
            fill="none"
            stroke="url(#treeBranchGrad)"
            strokeWidth="1.75"
            strokeDasharray="4 3"
            opacity="0.65"
          />
          <path
            d="M 390 95 C 390 130, 340 135, 340 165"
            fill="none"
            stroke="url(#treeBranchGrad)"
            strokeWidth="1.75"
            strokeDasharray="4 3"
            opacity="0.65"
          />

          {/* Grandparents marriage link */}
          <path
            d="M 220 195 L 320 195"
            fill="none"
            stroke="#C9A468"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            opacity="0.7"
          />

          {/* Grandparents down to Parents */}
          <path
            d="M 270 195 C 270 230, 270 240, 270 260"
            fill="none"
            stroke="url(#treeBranchGrad)"
            strokeWidth="2.25"
            opacity="0.85"
            filter="url(#softGlow)"
          />

          {/* Parents to Children */}
          <path
            d="M 270 320 C 270 355, 200 360, 200 395"
            fill="none"
            stroke="url(#treeBranchGrad)"
            strokeWidth="2"
            opacity="0.85"
          />
          <path
            d="M 270 320 C 270 355, 340 360, 340 395"
            fill="none"
            stroke="url(#treeBranchGrad)"
            strokeWidth="2.5"
            opacity="0.95"
            filter="url(#softGlow)"
          />
        </svg>

        {/* ─── Layer 1: Generation 1 (Great-Grandparents) [translateZ: -25px] ─── */}
        <div
          className="absolute top-8 left-[10%] flex items-center gap-2 bg-white/85 backdrop-blur-sm border border-[#E7E2D6] px-3 py-1.5 rounded-xl shadow-md text-left"
          style={{
            transform: "translateZ(-25px)",
            boxShadow: "0 10px 25px -5px rgba(28,75,60,0.12)",
          }}
        >
          <div className="w-6 h-6 rounded-full bg-[#EAE5D9] flex items-center justify-center text-[10px] font-bold text-[#1C4B3C]">
            W
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#1C1F1D] leading-tight">William Vance</p>
            <p className="text-[9px] text-[#9CA3AF]">1904 · Ancestor</p>
          </div>
        </div>

        <div
          className="absolute top-8 left-[42%] flex items-center gap-2 bg-white/85 backdrop-blur-sm border border-[#E7E2D6] px-3 py-1.5 rounded-xl shadow-md text-left"
          style={{
            transform: "translateZ(-25px)",
            boxShadow: "0 10px 25px -5px rgba(28,75,60,0.12)",
          }}
        >
          <div className="w-6 h-6 rounded-full bg-[#EAE5D9] flex items-center justify-center text-[10px] font-bold text-[#C9A468]">
            E
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#1C1F1D] leading-tight">Eleanor Sterling</p>
            <p className="text-[9px] text-[#9CA3AF]">1908 · Ancestor</p>
          </div>
        </div>

        <div
          className="absolute top-8 right-[8%] flex items-center gap-2 bg-white/85 backdrop-blur-sm border border-[#E7E2D6] px-3 py-1.5 rounded-xl shadow-md text-left"
          style={{
            transform: "translateZ(-25px)",
            boxShadow: "0 10px 25px -5px rgba(28,75,60,0.12)",
          }}
        >
          <div className="w-6 h-6 rounded-full bg-[#EAE5D9] flex items-center justify-center text-[10px] font-bold text-[#1C4B3C]">
            A
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#1C1F1D] leading-tight">Arthur Wright</p>
            <p className="text-[9px] text-[#9CA3AF]">1901 · Ancestor</p>
          </div>
        </div>

        {/* ─── Layer 2: Generation 2 (Grandparents) [translateZ: 10px] ─── */}
        <div
          className="absolute top-[165px] left-[20%] flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-[#C9BEA8]/50 px-3.5 py-2 rounded-xl shadow-lg text-left"
          style={{
            transform: "translateZ(10px)",
            boxShadow: "0 14px 30px -6px rgba(28,75,60,0.16)",
          }}
        >
          <div className="w-7 h-7 rounded-full bg-[#1C4B3C]/10 border border-[#1C4B3C]/20 flex items-center justify-center text-[11px] font-bold text-[#1C4B3C]">
            T
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1C1F1D] leading-tight">Thomas Vance</p>
            <p className="text-[10px] text-[#6B7280]">1935 · Grandfather</p>
          </div>
        </div>

        <div
          className="absolute top-[165px] right-[18%] flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-[#C9BEA8]/50 px-3.5 py-2 rounded-xl shadow-lg text-left"
          style={{
            transform: "translateZ(10px)",
            boxShadow: "0 14px 30px -6px rgba(28,75,60,0.16)",
          }}
        >
          <div className="w-7 h-7 rounded-full bg-[#C9A468]/15 border border-[#C9A468]/30 flex items-center justify-center text-[11px] font-bold text-[#9E7B35]">
            B
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1C1F1D] leading-tight">Beatrice Wright</p>
            <p className="text-[10px] text-[#6B7280]">1938 · Grandmother</p>
          </div>
        </div>

        {/* ─── Layer 3: Generation 3 (Parents) [translateZ: 38px] ─── */}
        <div
          className="absolute top-[265px] left-[26%] right-[26%] flex items-center justify-between bg-white border border-[#1C4B3C]/30 px-4 py-2.5 rounded-2xl shadow-xl text-left"
          style={{
            transform: "translateZ(38px)",
            boxShadow: "0 18px 36px -8px rgba(28,75,60,0.2)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                D
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#C9A468] text-white flex items-center justify-center text-[9px] font-bold">
                C
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[#1C1F1D] leading-tight">David & Clara Vance</p>
              <p className="text-[10px] text-[#1C4B3C] font-medium">Parents · Married 1990</p>
            </div>
          </div>
          <Heart className="w-3.5 h-3.5 text-[#C9A468] fill-[#C9A468]" />
        </div>

        {/* ─── Layer 4: Generation 4 (Children / Focus Node) [translateZ: 70px] ─── */}
        {/* Sibling card */}
        <div
          className="absolute bottom-6 left-[12%] flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-[#E7E2D6] px-3.5 py-2 rounded-xl shadow-lg text-left"
          style={{
            transform: "translateZ(55px)",
            boxShadow: "0 12px 28px -6px rgba(28,75,60,0.15)",
          }}
        >
          <div className="w-7 h-7 rounded-full bg-[#EAE5D9] flex items-center justify-center text-xs font-bold text-[#1C4B3C]">
            M
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1C1F1D] leading-tight">Maya Vance</p>
            <p className="text-[10px] text-[#6B7280]">1998 · Sibling</p>
          </div>
        </div>

        {/* Hero Focus Card: You */}
        <div
          className="absolute bottom-4 right-[10%] flex items-center gap-3 bg-gradient-to-r from-[#1C4B3C] to-[#245D4B] text-white px-4 py-3 rounded-2xl shadow-2xl text-left border border-[#3E806B]"
          style={{
            transform: "translateZ(75px)",
            boxShadow: "0 22px 45px -8px rgba(28,75,60,0.45)",
          }}
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-[#C9A468] text-white flex items-center justify-center text-sm font-bold shadow-md">
              J
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8C87A] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#E8C87A]" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-white tracking-wide">Julian Vance</p>
              <span className="text-[9px] uppercase tracking-wider font-bold bg-[#C9A468]/30 text-[#E8D9C0] px-1.5 py-0.5 rounded">
                You
              </span>
            </div>
            <p className="text-[10px] text-[#A8C4B9]">Root Record · 1995</p>
          </div>
        </div>

        {/* ─── Layer 5: Floating Badges [translateZ: 95px] ─── */}
        <div
          className="absolute top-2 right-2 bg-white/95 backdrop-blur-md border border-[#E7E2D6] px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5"
          style={{
            transform: "translateZ(95px)",
            boxShadow: "0 8px 24px -4px rgba(28,75,60,0.14)",
          }}
        >
          <Sparkles className="w-3 h-3 text-[#C9A468]" />
          <span className="text-[11px] font-semibold text-[#1C4B3C]">
            4 Generations Connected
          </span>
        </div>

        <div
          className="absolute -bottom-2 left-4 bg-white/95 backdrop-blur-md border border-[#E7E2D6] px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5"
          style={{
            transform: "translateZ(90px)",
            boxShadow: "0 8px 24px -4px rgba(28,75,60,0.14)",
          }}
        >
          <CheckCircle2 className="w-3 h-3 text-[#1C4B3C]" />
          <span className="text-[11px] font-semibold text-[#374151]">
            100% Private & Isolated
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Content Data (Refined, Professional, Jargon-Free) ────────────────────── */
const FEATURES = [
  {
    icon: Users,
    title: "Unlimited family members",
    body: "Document every branch of your lineage without artificial restrictions. Easily record parents, children, partners, in-laws, and extended kin in a unified family portrait.",
  },
  {
    icon: Share2,
    title: "Collaborative family sharing",
    body: "Invite relatives to experience your tree. Choose whether they can contribute new memories as Editors or simply explore as Viewers, keeping everyone connected.",
  },
  {
    icon: Layers,
    title: "Intelligent generational layout",
    body: "Describe your family relationships naturally. Rootline automatically arranges complex lineage, blended branches, and generations into a clear, balanced visual chart.",
  },
  {
    icon: ShieldCheck,
    title: "Private & dedicated vaults",
    body: "Your family records belong exclusively to you. Every family tree is maintained in its own private vault, completely protected and never combined with other users.",
  },
  {
    icon: GitBranch,
    title: "Kinship intelligence",
    body: "Simply record immediate family connections. Rootline automatically derives complete genealogical relationships, from first cousins to great-grandparents.",
  },
  {
    icon: Sparkles,
    title: "Your family guide",
    body: "Ask simple questions such as “How is Maya related to me?” and receive a clear explanation grounded in the family tree you build.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Create your private space",
    body: "Sign up in seconds. Your private family space is created immediately with zero complicated setup required.",
  },
  {
    n: "02",
    title: "Add your relatives & stories",
    body: "Enter family members with names, birth dates, and biographical notes. State how each person is related, and watch your tree take shape.",
  },
  {
    n: "03",
    title: "Explore and share together",
    body: "Navigate through generations interactively. Invite family members to view your legacy or collaborate on completing the family history.",
  },
];

/* ─── Main Landing Page Component ─────────────────────────────────────────── */
export default function RootlineHome() {
  const navigate = useNavigate();
  const onGetStarted = () => navigate("/register");
  const onSignIn = () => navigate("/login");

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col font-sans text-[#1C1F1D]">

      {/* ── Header / Navigation ── */}
      <header className="sticky top-0 z-40 flex justify-between md:grid md:grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 lg:px-16 py-3.5 sm:py-5 border-b border-[#E7E2D6] bg-[#F7F5F0]/95 backdrop-blur-sm">
        {/* Logo & Name directing to landing page */}
        <Link
          to="/"
          className="flex items-center gap-1.5 w-fit hover:opacity-85 transition-opacity"
          aria-label="Rootline Home"
        >
          <GitBranch className="w-4 h-4 text-[#1C4B3C]" strokeWidth={2.5} />
          <span className="text-[13px] tracking-[0.2em] font-semibold text-[#1C4B3C]">
            ROOTLINE
          </span>
        </Link>

        {/* Connected Nav Links */}
        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm font-medium text-[#6B7280] hover:text-[#1C1F1D] transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-medium text-[#6B7280] hover:text-[#1C1F1D] transition-colors"
          >
            How it works
          </a>
          <a
            href="#sharing"
            className="text-sm font-medium text-[#6B7280] hover:text-[#1C1F1D] transition-colors"
          >
            Collaboration
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center justify-self-end gap-5">
          <button
            onClick={onSignIn}
            className="text-sm font-medium text-[#374151] hover:text-[#1C1F1D] transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={onGetStarted}
            className="text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] transition-colors rounded-lg px-4 py-2 flex items-center gap-1.5 shadow-sm"
          >
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="px-5 sm:px-8 lg:px-16 py-10 sm:py-16 lg:py-24 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 75% 50%, rgba(28,75,60,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-14 items-center max-w-6xl mx-auto">
          {/* Left Hero Copy */}
          <div>
            <p className="text-[11px] tracking-[0.25em] font-semibold text-[#C9A468] mb-5 uppercase">
              Preserve your family's living heritage
            </p>
            <h1 className="text-4xl lg:text-[3.25rem] font-serif font-bold text-[#1C1F1D] leading-[1.14] mb-6">
              Every generation,<br />
              every branch —<br />
              <span style={{ color: "#1C4B3C" }}>recorded with care.</span>
            </h1>
            <p className="text-base text-[#6B7280] leading-relaxed mb-3 max-w-[440px]">
              Rootline transforms simple family memories, dates, and relationships into an elegant, interactive family tree — organized automatically.
            </p>
            <p className="text-sm text-[#9CA3AF] leading-relaxed mb-9 max-w-[440px]">
              Share your legacy with loved ones, invite relatives to contribute, and preserve your heritage in one secure, timeless space.
            </p>

            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={onGetStarted}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] transition-colors rounded-lg px-6 py-3.5 shadow-sm"
              >
                Start building your tree <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onSignIn}
                className="text-sm font-medium text-[#1C4B3C] hover:text-[#163D31] transition-colors underline underline-offset-4"
              >
                Sign in to your tree
              </button>
            </div>

            {/* Trust Highlights */}
            <div className="flex items-center gap-6 mt-10 flex-wrap">
              {[
                "No credit card required",
                "Private by default",
                "Always yours",
              ].map((text) => (
                <span key={text} className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A468] inline-block" />
                  {text}
                </span>
              ))}
            </div>
          </div>

          {/* Right — Interactive 3D Family Tree Canvas */}
          <div className="flex justify-center items-center py-2 sm:py-6 overflow-hidden w-full">
            <InteractiveFamilyTree3D />
          </div>
        </div>
      </section>

      {/* ── Key Highlights Strip (Professional & Jargon-Free) ── */}
      <div className="border-y border-[#E7E2D6] bg-white">
        <div className="max-w-6xl mx-auto px-8 lg:px-16 py-7 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "Unlimited", label: "Family members & generations" },
            { value: "3 Roles", label: "Owner · Editor · Viewer" },
            { value: "100% Private", label: "Your data stays yours" },
            { value: "Dedicated", label: "Individual family spaces" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-xl font-serif font-bold text-[#1C1F1D] mb-0.5">{value}</p>
              <p className="text-xs text-[#9CA3AF]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features Section ── */}
      <section id="features" className="px-8 lg:px-16 py-20 scroll-mt-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <p className="text-[11px] tracking-[0.2em] font-semibold text-[#C9A468] mb-3 uppercase">
              Platform Features
            </p>
            <h2 className="text-2xl lg:text-3xl font-serif font-bold text-[#1C1F1D] max-w-xl leading-snug">
              Crafted for real, complex family histories
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-white border border-[#E7E2D6] rounded-2xl p-6 hover:border-[#1C4B3C]/30 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-[#1C4B3C] flex items-center justify-center mb-5 shadow-xs">
                  <Icon className="w-4.5 h-4.5 text-[#EDEAE2]" strokeWidth={1.75} style={{ width: 18, height: 18 }} />
                </div>
                <h3 className="text-sm font-semibold text-[#1C1F1D] mb-2">{title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works Section ── */}
      <section id="how-it-works" className="px-8 lg:px-16 py-20 bg-[#16342B] text-white scroll-mt-12">
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] tracking-[0.2em] font-semibold text-[#C9A468] mb-3 uppercase">
            Simple Process
          </p>
          <h2 className="text-2xl lg:text-3xl font-serif font-bold text-white mb-14 max-w-lg leading-snug">
            From scattered memories to a timeless family record
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="relative">
                <div className="absolute top-5 left-12 right-0 h-px bg-[#2B5948] hidden md:block" aria-hidden="true" />
                <div className="relative z-10 flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#C9A468]/15 border border-[#C9A468]/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[#C9A468] font-serif">{n}</span>
                  </div>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-[#9BB0A6] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Collaborative Sharing Section ── */}
      <section id="sharing" className="px-8 lg:px-16 py-20 bg-white border-b border-[#E7E2D6] scroll-mt-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-[11px] tracking-[0.2em] font-semibold text-[#C9A468] mb-3 uppercase">
              Family Collaboration
            </p>
            <h2 className="text-2xl lg:text-3xl font-serif font-bold text-[#1C1F1D] mb-5 leading-snug">
              Share with relatives on your own terms
            </h2>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-6">
              Rootline gives you simple, granular control over who can view or contribute to your family tree. Invite relatives by email and choose their exact role — ensuring your family record is preserved accurately without accidental changes.
            </p>
            <ul className="space-y-3.5">
              {[
                { role: "Owner", desc: "Full control — manage tree settings, invite members, and edit all records." },
                { role: "Editor", desc: "Can add new relatives and enrich biographies, but cannot delete the tree or change sharing permissions." },
                { role: "Viewer", desc: "Read-only access — perfect for extended relatives who want to browse and cherish family history." },
              ].map(({ role, desc }) => (
                <li key={role} className="flex items-start gap-3">
                  <span className="mt-1 w-2 h-2 rounded-full bg-[#1C4B3C] shrink-0" />
                  <p className="text-sm text-[#4B5563]">
                    <strong className="text-[#1C1F1D] font-semibold">{role}:</strong> {desc}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual Permission Card */}
          <div className="bg-[#F7F5F0] border border-[#E7E2D6] rounded-2xl p-6 space-y-3 shadow-xs">
            <p className="text-xs font-semibold text-[#374151] mb-4">Tree Access & Permissions</p>
            {[
              { name: "Arjun Shetty", email: "arjun@example.com", role: "Owner", color: "bg-[#1C4B3C]/10 text-[#1C4B3C]" },
              { name: "Priya Shetty", email: "priya@example.com", role: "Editor", color: "bg-blue-50 text-blue-700" },
              { name: "Kiran Nair", email: "kiran@example.com", role: "Viewer", color: "bg-amber-50 text-amber-700" },
            ].map(({ name, email, role, color }) => (
              <div key={email} className="flex items-center gap-3 bg-white border border-[#E7E2D6] rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-[#E7E2D6] flex items-center justify-center shrink-0 text-xs font-semibold text-[#6B7280]">
                  {name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#1C1F1D] truncate">{name}</p>
                  <p className="text-[11px] text-[#9CA3AF] truncate">{email}</p>
                </div>
                <span className={`text-[11px] font-medium rounded-full px-2.5 py-0.5 ${color}`}>{role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Call To Action ── */}
      <section className="px-8 lg:px-16 py-20">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl lg:text-4xl font-serif font-bold text-[#1C1F1D] mb-4 leading-snug">
            Begin documenting your family's story today
          </h2>
          <p className="text-sm text-[#6B7280] max-w-md mx-auto mb-9">
            Create your free account and start recording the people, connections, and memories that form your family's living tapestry.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] transition-colors rounded-lg px-7 py-3.5 shadow-sm"
            >
              Create your family tree <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onSignIn}
              className="text-sm font-medium text-[#374151] hover:text-[#1C1F1D] transition-colors px-4 py-3"
            >
              Sign in to existing tree
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer with Connected Links & Clickable Logo ── */}
      <footer className="px-8 lg:px-16 py-14 border-t border-[#E7E2D6] bg-[#F7F5F0]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            {/* Column 1: Brand & Logo */}
            <div className="md:col-span-1">
              <Link
                to="/"
                className="flex items-center gap-1.5 mb-3 w-fit hover:opacity-85 transition-opacity"
                aria-label="Rootline Home"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#1C4B3C]" strokeWidth={2.5} />
                <span className="text-[11px] tracking-[0.2em] font-semibold text-[#1C4B3C]">
                  ROOTLINE
                </span>
              </Link>
              <p className="text-xs text-[#9CA3AF] leading-relaxed max-w-[220px]">
                A timeless family registry for documenting lineage, heritage, and kinship across generations.
              </p>
            </div>

            {/* Column 2: Navigation / Product */}
            <div>
              <p className="text-xs font-semibold text-[#374151] mb-3 uppercase tracking-wide">
                Platform
              </p>
              <ul className="space-y-2 text-xs text-[#6B7280]">
                <li>
                  <a href="#features" className="hover:text-[#1C1F1D] transition-colors">
                    Key features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-[#1C1F1D] transition-colors">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#sharing" className="hover:text-[#1C1F1D] transition-colors">
                    Family sharing
                  </a>
                </li>

              </ul>
            </div>

            {/* Column 3: Trust & Support */}
            <div>
              <p className="text-xs font-semibold text-[#374151] mb-3 uppercase tracking-wide">
                Support & Contact
              </p>
              <ul className="space-y-2 text-xs text-[#6B7280]">
                <li>
                  <a
                    href="mailto:support@rootline.app"
                    className="hover:text-[#1C1F1D] transition-colors"
                  >
                    Contact support
                  </a>
                </li>
                <li>
                  <button onClick={onSignIn} className="hover:text-[#1C1F1D] transition-colors">
                    Sign in to account
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Legal Pages */}
            <div>
              <p className="text-xs font-semibold text-[#374151] mb-3 uppercase tracking-wide">
                Legal
              </p>
              <ul className="space-y-2 text-xs text-[#6B7280]">
                <li>
                  <Link to="/terms" className="hover:text-[#1C1F1D] transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-[#1C1F1D] transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-7 border-t border-[#E7E2D6] flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <p className="text-xs text-[#9CA3AF]">
              © {new Date().getFullYear()} Rootline. All rights reserved.
            </p>
            <p className="text-xs text-[#9CA3AF] max-w-md">
              Rootline is an organizational platform for preserving family memories and does not independently constitute legal certification of lineage or estate rights.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
