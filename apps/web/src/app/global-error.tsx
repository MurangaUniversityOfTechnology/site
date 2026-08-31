"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#faf8f3",
          color: "#1a1a1a",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "0 20px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.035em", margin: 0 }}>
            Something went wrong.
          </h1>
          <p style={{ marginTop: "16px", color: "#7a7060", fontSize: "15.5px" }}>
            The whole app hit a snag — reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "26px",
              borderRadius: "8px",
              background: "#c9a84c",
              color: "#1a2744",
              fontWeight: 600,
              fontSize: "15px",
              padding: "14px 26px",
              border: 0,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
