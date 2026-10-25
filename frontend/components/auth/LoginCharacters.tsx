"use client";

import React, { useEffect, useRef, useState } from "react";

const STYLES = `
.login08-stage .char { transition: transform .35s cubic-bezier(.3, 1.6, .5, 1); }
.login08-stage.shy .char { transform: translateX(-8px); }
.login08-stage .face { will-change: transform; }
.login08-stage .lid { transform: scaleY(0); transform-box: fill-box; transform-origin: 50% 0; transition: transform .16s ease-in; }
.login08-stage .lash { opacity: 0; transition: opacity .1s; }
.login08-stage .char.blink .lid, .login08-stage.shy .lid { transform: scaleY(1); }
.login08-stage .char.blink .lash, .login08-stage.shy .lash { opacity: 1; transition-delay: .12s; }

/* Blue character peeks when password is revealed */
.login08-stage.shy.reveal #blue .lid { transform: scaleY(.55); }
.login08-stage.shy.reveal #blue .lash { opacity: 0; }

.login08-stage .mouth { transition: transform .2s; }
.login08-stage.shy .mouth { transform: scaleY(.35); }
.login08-stage .mouth { transform-box: fill-box; transform-origin: 50% 50%; }

@keyframes login08-nope {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-10px); }
  40% { transform: translateX(9px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(4px); }
}
.login08-stage.nope .face { animation: login08-nope .5s ease; }

@keyframes login08-hop {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-18px); }
}
.login08-stage.yay .char { animation: login08-hop .5s ease 2; }
.login08-stage.yay #yellow { animation-delay: .06s; }
.login08-stage.yay #red { animation-delay: .12s; }
.login08-stage.yay #teal { animation-delay: .18s; }
.login08-stage.yay #blue { animation-delay: .24s; }
.login08-stage.yay #pink { animation-delay: .3s; }

/* Entrance animations */
@keyframes login08-fall {
  from { transform: translateY(-44px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes login08-slide {
  from { transform: translateX(-44px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.login08-stage.intro #purple, .login08-stage.intro #red, .login08-stage.intro #blue {
  animation: login08-fall 1.1s cubic-bezier(.22, 1, .36, 1) backwards;
}
.login08-stage.intro #yellow, .login08-stage.intro #teal, .login08-stage.intro #pink {
  animation: login08-slide 1.1s cubic-bezier(.22, 1, .36, 1) backwards;
}
.login08-stage.intro #purple { animation-delay: 0s; }
.login08-stage.intro #yellow { animation-delay: .1s; }
.login08-stage.intro #red { animation-delay: .2s; }
.login08-stage.intro #teal { animation-delay: .3s; }
.login08-stage.intro #blue { animation-delay: .4s; }
.login08-stage.intro #pink { animation-delay: .5s; }

@media (prefers-reduced-motion: reduce) {
  .login08-stage.intro .char { animation: none; }
}
`;

export interface LoginCharactersProps {
  shy?: boolean;
  reveal?: boolean;
  status?: { type: "nope" | "yay" } | null;
}

export function LoginCharacters({ shy = false, reveal = false, status = null }: LoginCharactersProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const shyRef = useRef(shy);
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    shyRef.current = shy;
  }, [shy]);

  useEffect(() => {
    const timer = setTimeout(() => setIntro(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let blinkTimer: ReturnType<typeof setTimeout>;
    let blinkRemovalTimer: ReturnType<typeof setTimeout>;
    const stage = stageRef.current;
    const svg = svgRef.current;
    if (!stage || !svg) return;

    const CHARACTERS: Record<string, { lid: string; eyes: [number, number, number][] }> = {
      purple: { lid: "#9d84f8", eyes: [[124, 165, 24], [176, 154, 27]] },
      yellow: { lid: "#fbcb52", eyes: [[284, 240, 27], [344, 228, 29]] },
      red:    { lid: "#f86b7a", eyes: [[478, 168, 24], [540, 190, 27]] },
      teal:   { lid: "#5fdcc6", eyes: [[160, 350, 24], [212, 340, 26]] },
      blue:   { lid: "#3b97fa", eyes: [[310, 368, 22], [360, 358, 24]] },
      pink:   { lid: "#fba3d1", eyes: [[490, 364, 24], [546, 354, 26]] },
    };

    const createEl = (tag: string, attrs: Record<string, string | number>, parent?: Element) => {
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const key in attrs) {
        el.setAttribute(key, String(attrs[key]));
      }
      if (parent) parent.appendChild(el);
      return el;
    };

    interface EyeItem {
      cx: number;
      cy: number;
      r: number;
      pupil: Element;
      x: number;
      y: number;
    }

    interface FaceItem {
      node: HTMLElement | SVGElement;
      cx: number;
      cy: number;
      x: number;
      y: number;
    }

    const eyesList: EyeItem[] = [];
    const facesList: FaceItem[] = [];
    let clipIndex = 0;

    for (const charId in CHARACTERS) {
      const charConfig = CHARACTERS[charId];
      const charEl = svg.querySelector("#" + charId);
      const faceEl = charEl?.querySelector(".face");
      if (!faceEl) continue;

      let sumX = 0;
      let sumY = 0;

      charConfig.eyes.forEach(([cx, cy, r]) => {
        sumX += cx;
        sumY += cy;

        const eyeGroup = createEl("g", { "data-eye": "" }, faceEl);
        clipIndex++;
        const clipId = `login08-eyeclip-${clipIndex}`;
        const clipPath = createEl("clipPath", { id: clipId }, eyeGroup);
        createEl("circle", { cx, cy, r }, clipPath);

        // White eyeball
        createEl("circle", { cx, cy, r, fill: "#fff" }, eyeGroup);

        // Pupil group
        const pupilGroup = createEl("g", {}, eyeGroup);
        createEl("circle", { cx, cy, r: 0.4 * r, fill: "#16151f" }, pupilGroup);
        createEl("circle", { cx: cx - 0.12 * r, cy: cy - 0.14 * r, r: 0.11 * r, fill: "#fff" }, pupilGroup);

        // Eyelid with clipPath
        const lidGroup = createEl("g", { "clip-path": `url(#${clipId})` }, eyeGroup);
        createEl("rect", { class: "lid", x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, fill: charConfig.lid }, lidGroup);

        // Eyelash
        createEl(
          "path",
          {
            class: "lash",
            fill: "none",
            stroke: "#1f1d2b",
            "stroke-width": 4,
            "stroke-linecap": "round",
            d: `M${cx - 0.65 * r} ${cy + 0.1 * r} Q${cx} ${cy + 0.6 * r} ${cx + 0.65 * r} ${cy + 0.1 * r}`,
          },
          eyeGroup
        );

        eyesList.push({ cx, cy, r, pupil: pupilGroup, x: 0, y: 0 });
      });

      facesList.push({
        node: faceEl as SVGElement,
        cx: sumX / charConfig.eyes.length,
        cy: sumY / charConfig.eyes.length,
        x: 0,
        y: 0,
      });
    }

    // Default target: look towards the login card (right side)
    const target = { x: 9999, y: 260 };
    const pt = svg.createSVGPoint();

    const handlePointerMove = (e: PointerEvent) => {
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgPoint = pt.matrixTransform(ctm.inverse());
      target.x = svgPoint.x;
      target.y = svgPoint.y;
    };

    window.addEventListener("pointermove", handlePointerMove);

    const clampVector = (dx: number, dy: number, maxRadius: number): [number, number, number] => {
      const dist = Math.hypot(dx, dy) || 1;
      const ratio = Math.min(1, maxRadius / dist);
      return [dx * ratio, dy * ratio, dist];
    };

    let animId = 0;
    const renderLoop = () => {
      // Animate pupils
      for (const eye of eyesList) {
        const [targetX, targetY] = clampVector(target.x - eye.cx, target.y - eye.cy, 0.5 * eye.r);
        eye.x += (targetX - eye.x) * 0.2;
        eye.y += (targetY - eye.y) * 0.2;
        eye.pupil.setAttribute("transform", `translate(${eye.x.toFixed(2)} ${eye.y.toFixed(2)})`);
      }

      // Animate faces
      for (const face of facesList) {
        const [targetX, targetY] = shyRef.current
          ? [-20, 0]
          : clampVector(target.x - face.cx, target.y - face.cy, Math.min(9, Math.hypot(target.x - face.cx, target.y - face.cy) / 25));
        face.x += (targetX - face.x) * 0.12;
        face.y += (targetY - face.y) * 0.12;
        (face.node as HTMLElement).style.transform = `translate(${face.x.toFixed(2)}px, ${face.y.toFixed(2)}px)`;
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    // Random blinking
    const charIds = Object.keys(CHARACTERS);
    const scheduleBlink = () => {
      const randomId = charIds[Math.floor(Math.random() * charIds.length)];
      const targetChar = svg.querySelector("#" + randomId);
      targetChar?.classList.add("blink");
      blinkRemovalTimer = setTimeout(() => targetChar?.classList.remove("blink"), 180);
      blinkTimer = setTimeout(scheduleBlink, 700 + 1800 * Math.random());
    };
    scheduleBlink();

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(animId);
      clearTimeout(blinkTimer);
      clearTimeout(blinkRemovalTimer);
      svg.querySelectorAll("[data-eye]").forEach((el) => el.remove());
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.classList.remove("nope", "yay");
    if (status) {
      void stage.offsetWidth; // trigger reflow
      stage.classList.add(status.type);
    }
  }, [status]);

  return (
    <div
      ref={stageRef}
      className={`w-full login08-stage${intro ? " intro" : ""}${shy ? " shy" : ""}${reveal ? " reveal" : ""}`}
    >
      <style>{STYLES}</style>
      <svg
        ref={svgRef}
        id="crew"
        viewBox="0 0 660 520"
        aria-hidden="true"
        className="h-auto w-full scale-95 overflow-visible select-none pointer-events-none"
      >
        {/* Purple Monster */}
        <g className="char" id="purple">
          <line x1="118" y1="92" x2="98" y2="58" stroke="#9d84f8" strokeWidth="16" strokeLinecap="round" />
          <line x1="150" y1="86" x2="146" y2="40" stroke="#9d84f8" strokeWidth="16" strokeLinecap="round" />
          <path d="M70 150 Q70 80 140 80 Q210 80 210 150 V458 Q210 474 194 474 H86 Q70 474 70 458 Z" fill="#9d84f8" />
          <g className="face">
            <g className="mouth">
              <ellipse cx="146" cy="215" rx="17" ry="14" fill="#3e2a8e" />
              <rect x="140" y="201" width="11" height="9" rx="2" fill="#fff" />
            </g>
          </g>
        </g>

        {/* Yellow Monster */}
        <g className="char" id="yellow">
          <path d="M200 474 V280 Q200 150 312 150 Q424 150 424 280 V474 Z" fill="#fbcb52" />
          <g className="face">
            <path className="mouth" d="M298 288 Q314 302 330 288" fill="none" stroke="#1f1d2b" strokeWidth="6" strokeLinecap="round" />
          </g>
        </g>

        {/* Red / Coral Monster */}
        <g className="char" id="red">
          <path
            d="M440 118 Q478 86 528 106 Q590 132 598 190 Q606 240 566 262 Q598 292 576 332 Q556 372 504 366 L446 366 Q414 336 434 302 Q402 270 428 240 Q396 202 432 180 Q406 144 440 118 Z"
            fill="#f86b7a"
          />
          <g className="face">
            <g className="mouth">
              <ellipse cx="506" cy="232" rx="14" ry="12" fill="#8d1f33" />
              <rect x="501" y="220" width="9" height="8" rx="2" fill="#fff" />
            </g>
          </g>
        </g>

        {/* Teal Monster */}
        <g className="char" id="teal">
          <path d="M148 486 V445 A15 15 0 0 1 178 445 V486 Z" fill="#5fdcc6" />
          <path d="M198 486 V445 A15 15 0 0 1 228 445 V486 Z" fill="#5fdcc6" />
          <g fill="#5fdcc6">
            <circle cx="132" cy="352" r="46" />
            <circle cx="180" cy="318" r="50" />
            <circle cx="232" cy="342" r="46" />
            <circle cx="244" cy="394" r="42" />
            <circle cx="186" cy="404" r="56" />
            <circle cx="122" cy="400" r="42" />
            <circle cx="185" cy="370" r="55" />
          </g>
          <g className="face">
            <g className="mouth">
              <ellipse cx="190" cy="400" rx="17" ry="14" fill="#13806f" />
              <rect x="184" y="386" width="11" height="9" rx="2" fill="#fff" />
            </g>
          </g>
        </g>

        {/* Blue Monster */}
        <g className="char" id="blue">
          <line x1="312" y1="312" x2="296" y2="276" stroke="#3b97fa" strokeWidth="15" strokeLinecap="round" />
          <line x1="348" y1="310" x2="358" y2="272" stroke="#3b97fa" strokeWidth="15" strokeLinecap="round" />
          <path d="M302 486 V444 A14 14 0 0 1 330 444 V486 Z" fill="#3b97fa" />
          <path d="M342 486 V444 A14 14 0 0 1 370 444 V486 Z" fill="#3b97fa" />
          <circle cx="334" cy="382" r="76" fill="#3b97fa" />
          <g className="face">
            <g className="mouth">
              <ellipse cx="340" cy="420" rx="15" ry="13" fill="#0c4fb3" />
              <rect x="335" y="407" width="10" height="8" rx="2" fill="#fff" />
            </g>
          </g>
        </g>

        {/* Pink Monster */}
        <g className="char" id="pink">
          <path d="M418 484 V372 Q418 290 502 290 Q584 290 594 380 L606 484 H540 Q540 452 518 452 Q496 452 496 484 Z" fill="#fba3d1" />
          <g className="face">
            <g className="mouth">
              <ellipse cx="520" cy="412" rx="17" ry="14" fill="#8e1d52" />
              <rect x="514" y="398" width="11" height="9" rx="2" fill="#fff" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
