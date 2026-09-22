import { useEffect, useRef, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

const colors = ["#c355aa", "#ed4c9c", "#503bb5", "#b695e5"];
/** Mount only during capture; stop animation offscreen or when motion is reduced. */
export function WebPageFetching() {
  const host = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const update = () =>
      setAnimate(visible && !document.hidden && !preference.matches);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    if (host.current) observer.observe(host.current);
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <div
      ref={host}
      className="web-page-fetching"
      role="status"
      aria-label="Fetching web page"
    >
      <MeshGradient
        aria-hidden="true"
        width="100%"
        height="100%"
        colors={colors}
        distortion={0.8}
        swirl={0.35}
        grainMixer={0}
        grainOverlay={0}
        speed={animate ? 0.3 : 0}
        frame={14000}
        minPixelRatio={1}
        maxPixelCount={240000}
      />
      <span>
        <GlobeAltIcon aria-hidden="true" />
        Fetching
      </span>
    </div>
  );
}
