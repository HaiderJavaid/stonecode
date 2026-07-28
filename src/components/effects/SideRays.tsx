import { useEffect, useRef, useState } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import "./SideRays.css";

type SideRaysOrigin = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type SideRaysProps = {
  speed?: number;
  rayColor1?: string;
  rayColor2?: string;
  intensity?: number;
  spread?: number;
  origin?: SideRaysOrigin;
  tilt?: number;
  saturation?: number;
  blend?: number;
  falloff?: number;
  opacity?: number;
  maxDpr?: number;
  fps?: number;
  className?: string;
};

type SideRaysUniforms = {
  iTime: { value: number };
  iResolution: { value: number[] };
  iSpeed: { value: number };
  iRayColor1: { value: number[] };
  iRayColor2: { value: number[] };
  iIntensity: { value: number };
  iSpread: { value: number };
  iFlipX: { value: number };
  iFlipY: { value: number };
  iTilt: { value: number };
  iSaturation: { value: number };
  iBlend: { value: number };
  iFalloff: { value: number };
  iOpacity: { value: number };
};

function hexToRgb(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255]
    : [1, 1, 1];
}

function originToFlip(origin: SideRaysOrigin) {
  switch (origin) {
    case "top-left":
      return [1, 0];
    case "bottom-right":
      return [0, 1];
    case "bottom-left":
      return [1, 1];
    case "top-right":
      return [0, 0];
    default:
      return [0, 0];
  }
}

const vertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;
  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);
  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`;

export default function SideRays({
  speed = 2.5,
  rayColor1 = "#EAB308",
  rayColor2 = "#96c8ff",
  intensity = 2,
  spread = 2,
  origin = "top-left",
  tilt = 0,
  saturation = 1.5,
  blend = 0.75,
  falloff = 4,
  opacity = 1,
  maxDpr = 1.5,
  fps = 30,
  className = ""
}: SideRaysProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef<SideRaysUniforms | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isInViewportRef = useRef(false);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(([entry]) => {
      const isInViewport = entry?.isIntersecting ?? false;
      isInViewportRef.current = isInViewport;
      if (isInViewport) setHasEnteredViewport(true);
    }, { threshold: 0.1 });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasEnteredViewport || !containerRef.current) return;
    cleanupRef.current?.();

    let cancelled = false;

    async function initializeWebGL() {
      await new Promise((resolve) => window.setTimeout(resolve, 10));
      const container = containerRef.current;
      if (cancelled || !container) return;

      const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, maxDpr), alpha: true });
      rendererRef.current = renderer;
      const gl = renderer.gl;
      gl.canvas.style.width = "100%";
      gl.canvas.style.height = "100%";
      container.replaceChildren(gl.canvas);

      const [flipX, flipY] = originToFlip(origin);
      const uniforms: SideRaysUniforms = {
        iTime: { value: 0 },
        iResolution: { value: [1, 1] },
        iSpeed: { value: speed },
        iRayColor1: { value: hexToRgb(rayColor1) },
        iRayColor2: { value: hexToRgb(rayColor2) },
        iIntensity: { value: intensity },
        iSpread: { value: spread },
        iFlipX: { value: flipX },
        iFlipY: { value: flipY },
        iTilt: { value: tilt },
        iSaturation: { value: saturation },
        iBlend: { value: blend },
        iFalloff: { value: falloff },
        iOpacity: { value: opacity }
      };
      uniformsRef.current = uniforms;

      const geometry = new Triangle(gl);
      const program = new Program(gl, { vertex: vertexShader, fragment: fragmentShader, uniforms });
      const mesh = new Mesh(gl, { geometry, program });
      meshRef.current = mesh;

      const updateSize = () => {
        const activeContainer = containerRef.current;
        if (!activeContainer) return;
        renderer.dpr = Math.min(window.devicePixelRatio, maxDpr);
        const { clientWidth, clientHeight } = activeContainer;
        renderer.setSize(clientWidth, clientHeight);
        uniforms.iResolution.value = [clientWidth * renderer.dpr, clientHeight * renderer.dpr];
        if (reduceMotion) renderer.render({ scene: mesh });
      };

      let lastRenderTime = 0;
      const frameInterval = 1000 / Math.max(1, fps);
      const loop = (time: number) => {
        if (!rendererRef.current || !uniformsRef.current || !meshRef.current) return;
        if (isInViewportRef.current && time - lastRenderTime >= frameInterval) {
          uniforms.iTime.value = time * 0.001;
          renderer.render({ scene: mesh });
          lastRenderTime = time;
        }
        animationIdRef.current = window.requestAnimationFrame(loop);
      };

      window.addEventListener("resize", updateSize);
      updateSize();
      if (!reduceMotion) animationIdRef.current = window.requestAnimationFrame(loop);

      cleanupRef.current = () => {
        if (animationIdRef.current !== null) window.cancelAnimationFrame(animationIdRef.current);
        window.removeEventListener("resize", updateSize);
        try {
          renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
          renderer.gl.canvas.remove();
        } catch {
          // The browser may have already released the canvas.
        }
        animationIdRef.current = null;
        rendererRef.current = null;
        uniformsRef.current = null;
        meshRef.current = null;
      };
    }

    void initializeWebGL();
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [blend, falloff, fps, hasEnteredViewport, intensity, maxDpr, opacity, origin, rayColor1, rayColor2, reduceMotion, saturation, speed, spread, tilt]);

  return <div ref={containerRef} className={`side-rays-container ${className}`.trim()} />;
}
