"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { CountUp } from "./CountUp";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 110, damping: 24, mass: 0.4 });
  const headlineY = useTransform(smoothProgress, [0, 1], [0, -120]);
  const headlineOpacity = useTransform(smoothProgress, [0, 0.7], [1, 0]);
  const orbY = useTransform(smoothProgress, [0, 1], [0, 220]);
  const orbScale = useTransform(smoothProgress, [0, 1], [1, 1.4]);

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
      <motion.div
        style={{ y: orbY, scale: orbScale }}
        className="absolute -top-32 right-[-10%] w-[640px] h-[640px] rounded-full blur-3xl opacity-55 pointer-events-none parallax-soft"
      >
        <div className="w-full h-full rounded-full" style={{ background: "radial-gradient(circle, rgba(255,122,26,0.45), transparent 60%)" }} />
      </motion.div>

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-10 pt-24 md:pt-36 pb-24 md:pb-36">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 mb-12"
        >
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_22px_var(--accent-glow)]" />
          <span className="tick">Live · Multimodal Inspection Engine</span>
        </motion.div>

        <motion.h1
          style={{ y: headlineY, opacity: headlineOpacity }}
          className="h-display text-[72px] md:text-[136px] lg:text-[168px] parallax-soft"
        >
          {["See every", "crack,", "hotspot, and", "kilowatt", "left on the table."].map((line, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.08 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="block"
              style={{
                color: i === 1 ? "var(--accent-2)" : i === 2 || i === 4 ? "var(--fg-dim)" : undefined,
                fontStyle: i === 1 ? "italic" : undefined,
              }}
            >
              {line}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 max-w-[760px] body-lg text-[1.25rem] md:text-[1.4rem] leading-[1.5]"
        >
          SOLARIS ingests a single panel photo or an entire fleet upload, runs frontier vision
          models against a 21-defect taxonomy, and synthesizes an executive O&amp;M report with
          quantified efficiency loss and prioritized actions — in under a minute.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.85 }}
          className="mt-14 flex flex-wrap items-center gap-4"
        >
          <a href="#analyze" className="btn-primary inline-flex items-center gap-2">
            Begin inspection
            <ArrowDown size={16} />
          </a>
          <a href="#how" className="btn-ghost">How it works</a>

          <div className="flex items-center gap-3 ml-2">
            <span className="tick">Powered by</span>
            <span className="font-mono text-[13px] text-[var(--fg-dim)]">Gemini Vision</span>
            <span className="text-[var(--fg-mute)]">·</span>
            <span className="font-mono text-[13px] text-[var(--fg-dim)]">Llama 3.3 70B</span>
          </div>
        </motion.div>

        <div className="mt-28 grid grid-cols-2 md:grid-cols-4 gap-7 md:gap-10" id="capabilities">
          {[
            { num: 21, suf: "", l: "Defect classes detected" },
            { num: 60, suf: "s", prefix: "<", l: "Per-fleet inspection" },
            { num: 100, suf: "", l: "Calibrated condition scoring" },
            { num: 0, suf: "", lit: "kWh/kW", l: "Quantified energy loss" },
          ].map((s, i) => (
            <motion.div
              key={s.l}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-12% 0px" }}
              transition={{ duration: 0.85, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="border-t hairline-strong pt-6"
            >
              <div className="stat-num">
                {s.lit ?? (
                  <>
                    {s.prefix && <span className="text-[var(--fg-mute)]">{s.prefix}</span>}
                    <CountUp to={s.num} suffix={s.suf} />
                  </>
                )}
              </div>
              <div className="tick mt-4">{s.l}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="divider" />
    </section>
  );
}
