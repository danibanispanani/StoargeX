import { Coins, Package, ShoppingCart, Tag } from "lucide-react";

// Signature-Element "Routenlinie": Warenfluss Einkauf -> Lager -> Verkauf ->
// Auszahlung. Der Pfad zeichnet sich beim Laden selbst (stroke-dashoffset,
// CSS in globals.css), die Stationen erscheinen zeitversetzt.
// prefers-reduced-motion: nur Opacity, keine Zeichen-Animation.

const STATIONS = [
  { x: 70, y: 150, label: "Einkauf", Icon: ShoppingCart },
  { x: 300, y: 80, label: "Lager", Icon: Package },
  { x: 530, y: 160, label: "Verkauf", Icon: Tag },
  { x: 740, y: 70, label: "Auszahlung", Icon: Coins },
];

const PATH =
  "M 70 150 C 150 150, 210 80, 300 80 S 450 160, 530 160 S 660 70, 740 70";

export function RouteLine() {
  return (
    <svg
      viewBox="0 0 810 230"
      role="img"
      aria-label="Warenfluss: Einkauf, Lager, Verkauf, Auszahlung"
      className="w-full max-w-3xl"
    >
      {/* Hintergrund-Spur */}
      <path
        d={PATH}
        fill="none"
        stroke="var(--border)"
        strokeWidth="2"
        strokeDasharray="4 6"
      />
      {/* Animierte Routenlinie */}
      <path
        d={PATH}
        fill="none"
        stroke="var(--transit-teal)"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={1200}
        className="sx-route-path"
        style={{ "--route-length": 1200 } as React.CSSProperties}
      />
      {STATIONS.map((station, index) => (
        <g
          key={station.label}
          className="sx-route-station"
          style={{ animationDelay: `${0.5 + index * 0.4}s` }}
        >
          <circle
            cx={station.x}
            cy={station.y}
            r="26"
            fill="var(--card)"
            stroke={index === STATIONS.length - 1 ? "var(--cargo-amber)" : "var(--transit-teal)"}
            strokeWidth="2.5"
          />
          <svg
            x={station.x - 12}
            y={station.y - 12}
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <station.Icon
              size={24}
              color={
                index === STATIONS.length - 1
                  ? "var(--cargo-amber)"
                  : "var(--transit-teal)"
              }
              strokeWidth={2}
            />
          </svg>
          <text
            x={station.x}
            y={station.y + 48}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize="14"
            fontFamily="var(--font-space-grotesk), sans-serif"
          >
            {station.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
