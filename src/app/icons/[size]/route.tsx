import { ImageResponse } from "next/og";

// Clock icon drawn in the app's accent color. Full-bleed so it also works as a maskable icon:
// all artwork sits inside the central 60% safe zone.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Math.min(Math.max(parseInt((await params).size, 10) || 512, 48), 1024);
  const ring = size * 0.5;
  const stroke = size * 0.05;
  const hand = size * 0.04;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f5d9e",
        }}
      >
        <div
          style={{
            width: ring,
            height: ring,
            borderRadius: "50%",
            border: `${stroke}px solid #fff`,
            display: "flex",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: ring / 2 - stroke - hand / 2,
              top: ring * 0.14,
              width: hand,
              height: ring * 0.36,
              background: "#fff",
              borderRadius: hand,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: ring / 2 - stroke - hand / 2,
              top: ring / 2 - stroke - hand / 2,
              width: ring * 0.26,
              height: hand,
              background: "#fff",
              borderRadius: hand,
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
