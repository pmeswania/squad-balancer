import React from 'react';

interface LogoProps {
  className?: string;
  size?: number; // overall height or scaling
  showText?: boolean;
}

/**
 * High-fidelity vector SVG representation of the Harrow College Old Boys Football Club Logo.
 * Features the signature crimson shield, golden dual-border, old boy stick figure with a walking stick,
 * custom white serif "Harrow" typography, and detailed black-and-white soccer ball 'o'.
 */
export function ClubLogo({ className = '', size = 56, showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Dynamic Master Logo Container */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md hover:scale-105 transition-transform duration-300"
      >
        {/* Definitions for Gradients and Shadows */}
        <defs>
          {/* Crimson Velvet Gradient */}
          <linearGradient id="maroon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9B1C1C" />
            <stop offset="50%" stopColor="#801818" />
            <stop offset="100%" stopColor="#5C1010" />
          </linearGradient>

          {/* Premium Gold Metallic Gradient for borders and Stick man */}
          <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F9DF95" />
            <stop offset="35%" stopColor="#D4AF37" />
            <stop offset="70%" stopColor="#AA7C11" />
            <stop offset="100%" stopColor="#E6B524" />
          </linearGradient>

          {/* Dual Gold Border shadow */}
          <filter id="gold-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* --- SHIELD BACKGROUND --- */}
        {/* Elegant crimson shield with a custom path matching the classic badge look */}
        <path
          d="M 50 50 
             L 450 50 
             C 450 250, 410 380, 250 460 
             C 90 380, 50 250, 50 50 Z"
          fill="url(#maroon-grad)"
          stroke="url(#gold-grad)"
          strokeWidth="6"
          strokeLinejoin="round"
        />

        {/* Inner golden offset border segment */}
        <path
          d="M 68 68 
             L 432 68 
             C 432 240, 396 360, 250 435 
             C 104 360, 68 240, 68 68 Z"
          stroke="url(#gold-grad)"
          strokeWidth="2"
          strokeDasharray="1 1"
          opacity="0.85"
        />

        {/* Bottom decorative gold chevron framing lines */}
        <path
          d="M 120 370 
             C 180 410, 220 425, 250 435 
             C 280 425, 320 410, 380 370"
          stroke="url(#gold-grad)"
          strokeWidth="3"
          fill="none"
          opacity="0.9"
        />

        {/* --- STICK MAN (OLD BOY KICKING BALL) --- */}
        <g stroke="url(#gold-grad)" strokeLinecap="round" strokeLinejoin="round" filter="url(#gold-glow)">
          {/* Head */}
          <circle cx="255" cy="115" r="16" fill="url(#gold-grad)" stroke="none" />
          
          {/* Cane / Walking Stick */}
          <line x1="262" y1="135" x2="295" y2="240" strokeWidth="6" />
          <path d="M 295 240 Q 298 247, 303 241" fill="none" strokeWidth="6" />

          {/* Spine / Body torso */}
          <path d="M 255 131 Q 240 160, 250 185" fill="none" strokeWidth="10" />

          {/* Left Arm leaning on Cane */}
          <path d="M 251 140 Q 268 152, 275 178" fill="none" strokeWidth="6" />

          {/* Right Arm swinging for balance */}
          <path d="M 245 138 Q 224 150, 218 180" fill="none" strokeWidth="6" />

          {/* Left Leg leaning */}
          <path d="M 250 185 Q 262 215, 252 238" fill="none" strokeWidth="9" />
          <path d="M 252 238 Q 256 242, 264 238" fill="none" strokeWidth="8" />

          {/* Right Leg kicking forward */}
          <path d="M 250 185 Q 226 205, 220 232" fill="none" strokeWidth="9" />
          {/* Foot kicking */}
          <path d="M 220 232 Q 225 237, 234 233" fill="none" strokeWidth="8" />

          {/* Small ball near foot */}
          <circle cx="273" cy="235" r="11" fill="url(#maroon-grad)" strokeWidth="4" />
          {/* Little cross inside ball to make it look active */}
          <line x1="268" y1="235" x2="278" y2="235" strokeWidth="2" />
          <line x1="273" y1="230" x2="273" y2="240" strokeWidth="2" />
        </g>

        {/* --- HARROW WORD / TYPOGRAPHY --- */}
        {/* Letters "H", "a", "r", "r", [Soccer Ball], "w" */}
        {/* Visual layout centers around middle row */}
        <g filter="url(#gold-glow)">
          {/* "H" */}
          <text
            x="48"
            y="320"
            fontFamily="Georgia, serif"
            fontSize="105"
            fontWeight="bold"
            fill="#FFFFFF"
            letterSpacing="-2"
          >
            H
          </text>
          {/* "a" */}
          <text
            x="137"
            y="320"
            fontFamily="Georgia, serif"
            fontSize="92"
            fill="#FFFFFF"
            letterSpacing="-1"
          >
            a
          </text>
          {/* "r" */}
          <text
            x="184"
            y="320"
            fontFamily="Georgia, serif"
            fontSize="92"
            fill="#FFFFFF"
            letterSpacing="-2"
          >
            r
          </text>
          {/* "r" */}
          <text
            x="222"
            y="320"
            fontFamily="Georgia, serif"
            fontSize="92"
            fill="#FFFFFF"
            letterSpacing="-1"
          >
            r
          </text>

          {/* --- SOCCER BALL "O" --- */}
          <g>
            {/* Outer skin */}
            <circle cx="317" cy="272" r="43" fill="#FFFFFF" stroke="#1E293B" strokeWidth="4" />
            
            {/* Pentagon center */}
            <polygon points="317,249 333,261 327,281 307,281 301,261" fill="#1E293B" />
            
            {/* Stitch lines radiated outwards to perimeter */}
            <line x1="317" y1="249" x2="317" y2="229" stroke="#1E293B" strokeWidth="3" />
            <line x1="333" y1="261" x2="351" y2="252" stroke="#1E293B" strokeWidth="3" />
            <line x1="327" y1="281" x2="341" y2="299" stroke="#1E293B" strokeWidth="3" />
            <line x1="307" y1="281" x2="293" y2="299" stroke="#1E293B" strokeWidth="3" />
            <line x1="301" y1="261" x2="283" y2="252" stroke="#1E293B" strokeWidth="3" />

            {/* Perimeter mini pentagons cuts */}
            <polygon points="310,229 324,229 317,238" fill="#1E293B" />
            <polygon points="351,252 355,263 344,260" fill="#1E293B" />
            <polygon points="341,299 333,307 334,295" fill="#1E293B" />
            <polygon points="293,299 301,307 300,295" fill="#1E293B" />
            <polygon points="283,252 279,263 290,260" fill="#1E293B" />
          </g>

          {/* "w" */}
          <text
            x="364"
            y="320"
            fontFamily="Georgia, serif"
            fontSize="92"
            fill="#FFFFFF"
            letterSpacing="-2"
          >
            w
          </text>
        </g>

        {/* --- FOOTBALL CLUB SUBTITLE TEXT --- */}
        <text
          x="250"
          y="370"
          fontFamily="'Cabinet Grotesk', 'Inter', sans-serif"
          fontSize="24"
          fontWeight="900"
          fill="url(#gold-grad)"
          letterSpacing="4"
          textAnchor="middle"
        >
          HARROW OLD BOYS
        </text>
        <text
          x="250"
          y="398"
          fontFamily="'Cabinet Grotesk', 'Inter', sans-serif"
          fontSize="24"
          fontWeight="900"
          fill="url(#gold-grad)"
          letterSpacing="4"
          textAnchor="middle"
        >
          FOOTBALL CLUB
        </text>
      </svg>

      {/* Accompanying Club Title Text */}
      {showText && (
        <div className="flex flex-col">
          <span className="font-extrabold text-base tracking-tight text-white leading-none">
            HCOBF
          </span>
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mt-0.5">
            Harrow Old Boys FC
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Beautiful full-screen club logo showcase banner card. Used to highlight
 * HCOBF identity inside dashboard main panel.
 */
export function ClubBanner() {
  return (
    <div className="bg-gradient-to-br from-[#681414] via-[#831818] to-[#430909] text-white rounded-2xl border border-amber-500/20 shadow-xl p-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
      {/* Decorative soccer grid overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      
      {/* Absolute gold decorative badge background */}
      <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl opacity-60" />

      {/* Premium Club Logo vector */}
      <ClubLogo size={145} showText={false} className="shrink-0 drop-shadow-2xl" />

      {/* Club Context Info */}
      <div className="flex-1 text-center md:text-left z-10">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Official Club Balancer
        </div>
        
        <h2 className="text-2xl font-black tracking-tight text-white leading-tight">
          HARROW COLLEGE OLD BOYS FC
        </h2>
        
        <p className="text-xs text-red-100/80 mt-1 max-w-xl leading-relaxed font-medium">
          Welcome to the HCOBF squad balancing portal. Manage player rating matrixes directly, paste weekly attendance sign-ups, and generate perfectly-matched squads.
        </p>

        {/* Quick info points */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 mt-4 text-[11px] text-amber-200/90 font-mono">
          <div className="flex items-center gap-1">
            <span className="text-amber-400 font-bold">✓</span> Goalkeeper Matching
          </div>
          <div className="flex items-center gap-1">
            <span className="text-amber-400 font-bold">✓</span> Direct Excel/CSV Sync
          </div>
          <div className="flex items-center gap-1">
            <span className="text-amber-400 font-bold">✓</span> Interactive Player Swaps
          </div>
        </div>
      </div>
    </div>
  );
}
