/**
 * SVG filter used by `.liquid` surfaces. A low-frequency noise field displaces the
 * backdrop slightly so content behind small controls bends like it would through
 * a drop of water, then a specular lighting pass adds the glossy edge.
 */
export function LiquidFilter() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter
          id="hz-liquid"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.012"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="38"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bent"
          />
          <feSpecularLighting
            in="soft"
            surfaceScale="3"
            specularConstant="0.6"
            specularExponent="90"
            lightingColor="#ffffff"
            result="spec"
          >
            <fePointLight x="-120" y="-200" z="300" />
          </feSpecularLighting>
          <feComposite
            in="spec"
            in2="SourceAlpha"
            operator="in"
            result="specIn"
          />
          <feBlend in="bent" in2="specIn" mode="screen" />
        </filter>
      </defs>
    </svg>
  )
}
