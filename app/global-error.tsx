"use client";

// Last resort: this replaces the ROOT layout, so it must ship its own <html> and <body> and
// cannot use anything from the app shell — no fonts, no theme script, no shared components.
// Deliberately plain, with inline styles, because whatever failed may be the stylesheet itself.
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#eef0e7",
          color: "#2c2821",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "1rem"
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Padho.</p>
          <h1 style={{ fontSize: "1.5rem", margin: "1.5rem 0 0" }}>Something went badly wrong.</h1>
          <p style={{ color: "#5b564c", lineHeight: 1.6 }}>
            The page could not be loaded at all. Reloading usually fixes it.
          </p>
          {error.digest ? (
            <p style={{ color: "#5b564c", fontSize: ".8rem" }}>Reference {error.digest}</p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: ".625rem 1.25rem",
              borderRadius: ".5rem",
              border: 0,
              background: "#1a6b63",
              color: "#fff",
              fontSize: ".875rem",
              cursor: "pointer"
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
