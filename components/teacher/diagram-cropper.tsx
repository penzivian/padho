"use client";

import { Crop, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Crops a diagram straight out of the paper the teacher already uploaded.
//
// Rendering happens in the BROWSER, not on the server, for three reasons: the File is already
// in the page so there is nothing to re-upload; server-side rasterising needs @napi-rs/canvas,
// a ~30MB native binary that eats the Vercel Hobby function budget; and a drag-to-select needs
// the rendered page on screen anyway.
//
// Works on scanned papers and photos too. Text extraction fails on those (no text layer), but
// cropping does not care — the teacher types the stem and crops the figure.

// Render above display size so a crop of a small figure is still sharp on a retina screen.
const RENDER_QUALITY = 2;
// Cap on the stored crop's long edge. A full-page crop at quality 2 is ~2400px and megabytes;
// question diagrams are read at a few hundred px on a phone, and the bucket caps at 5MB.
const MAX_CROP_EDGE = 1400;
// Below this a drag is a mis-click, not a selection.
const MIN_SELECTION_PX = 8;

type Rect = { x: number; y: number; width: number; height: number };

type Point = { x: number; y: number };

function rectFrom(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  };
}

export function DiagramCropper({
  file,
  questionNumber,
  onCropped,
  onClose
}: {
  file: File;
  questionNumber: number;
  onCropped: (blob: Blob) => void | Promise<void>;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Held in a ref, not state: the render effect must not re-run when the page count arrives.
  const docRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null);

  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [saving, setSaving] = useState(false);

  const isPdf = file.type.includes("pdf");

  // Translate a pointer position into canvas pixels. The canvas is displayed at CSS width
  // 100%, so its backing store is larger than its box and the two differ by a scale factor.
  const toCanvasPoint = useCallback((event: React.PointerEvent<HTMLDivElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const box = canvas.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    return {
      x: ((event.clientX - box.left) / box.width) * canvas.width,
      y: ((event.clientY - box.top) / box.height) * canvas.height
    };
  }, []);

  // Draw the current page (or the image) into the canvas.
  useEffect(() => {
    let cancelled = false;

    async function render() {
      setStatus("loading");
      setSelection(null);
      setDragStart(null);
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser cannot render the page for cropping.");

        if (!isPdf) {
          const bitmap = await createImageBitmap(file);
          if (cancelled) return;
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          context.drawImage(bitmap, 0, 0);
          bitmap.close();
          setTotalPages(1);
          setStatus("ready");
          return;
        }

        // Dynamic import: unpdf bundles pdfjs, which is far too big to sit in the paper
        // builder's bundle for a tool most sessions never open.
        if (!docRef.current) {
          const { getDocumentProxy } = await import("unpdf");
          const bytes = new Uint8Array(await file.arrayBuffer());
          const pdf = await getDocumentProxy(bytes);
          if (cancelled) return;
          docRef.current = pdf as unknown as typeof docRef.current;
          setTotalPages(pdf.numPages);
        }

        const pdf = docRef.current;
        if (!pdf) return;
        const page = (await pdf.getPage(pageNumber)) as {
          getViewport: (options: { scale: number }) => { width: number; height: number };
          render: (options: Record<string, unknown>) => { promise: Promise<void> };
        };
        if (cancelled) return;

        // Scale so the rendered page is RENDER_QUALITY times its on-screen width.
        const base = page.getViewport({ scale: 1 });
        const displayWidth = canvas.parentElement?.clientWidth || base.width;
        const viewport = page.getViewport({
          scale: (displayWidth * RENDER_QUALITY) / base.width
        });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        // Figures are line art on white; without this they render onto transparency and a
        // webp crop of them comes out black.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        // Both `canvas` and `canvasContext` — pdfjs v5 wants the element as well.
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (cancelled) return;
        setStatus("ready");
      } catch (renderError) {
        if (cancelled) return;
        setError(renderError instanceof Error ? renderError.message : "Could not open this file.");
        setStatus("error");
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [file, isPdf, pageNumber]);

  // Escape closes, matching the CBT dialog.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function attachSelection() {
    const canvas = canvasRef.current;
    if (!canvas || !selection) return;

    setSaving(true);
    try {
      // Downscale only if the crop is genuinely large; never upscale a small figure.
      const longEdge = Math.max(selection.width, selection.height);
      const scale = longEdge > MAX_CROP_EDGE ? MAX_CROP_EDGE / longEdge : 1;

      const output = document.createElement("canvas");
      output.width = Math.max(1, Math.round(selection.width * scale));
      output.height = Math.max(1, Math.round(selection.height * scale));
      const context = output.getContext("2d");
      if (!context) throw new Error("This browser cannot crop the selection.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, output.width, output.height);
      context.drawImage(
        canvas,
        selection.x,
        selection.y,
        selection.width,
        selection.height,
        0,
        0,
        output.width,
        output.height
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        output.toBlob(resolve, "image/webp", 0.85)
      );
      if (!blob) throw new Error("Could not build the image.");
      await onCropped(blob);
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Could not crop the selection.");
    } finally {
      setSaving(false);
    }
  }

  // Selection is in canvas pixels; the overlay is in CSS pixels, so express it in percentages.
  const canvas = canvasRef.current;
  const overlayStyle =
    selection && canvas
      ? {
          left: `${(selection.x / canvas.width) * 100}%`,
          top: `${(selection.y / canvas.height) * 100}%`,
          width: `${(selection.width / canvas.width) * 100}%`,
          height: `${(selection.height / canvas.height) * 100}%`
        }
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <Card className="my-4 w-full max-w-3xl">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crop className="h-5 w-5 text-primary" aria-hidden="true" />
              Crop a diagram for question {questionNumber}
            </CardTitle>
            <p className="script-note mt-0.5">Drag a box around the figure —</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </CardHeader>

        {isPdf && totalPages > 1 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pageNumber <= 1 || status === "loading"}
              onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              Page {pageNumber} / {totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pageNumber >= totalPages || status === "loading"}
              onClick={() => setPageNumber((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </Button>
          </div>
        ) : null}

        <div
          className="relative touch-none select-none overflow-hidden rounded-md border bg-white"
          onPointerDown={(event) => {
            if (status !== "ready") return;
            const point = toCanvasPoint(event);
            if (!point) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragStart(point);
            setSelection(null);
          }}
          onPointerMove={(event) => {
            if (!dragStart) return;
            const point = toCanvasPoint(event);
            if (point) setSelection(rectFrom(dragStart, point));
          }}
          onPointerUp={(event) => {
            if (!dragStart) return;
            const point = toCanvasPoint(event);
            const next = point ? rectFrom(dragStart, point) : null;
            setDragStart(null);
            // A click with no drag clears the selection rather than attaching a 1px image.
            setSelection(
              next && next.width >= MIN_SELECTION_PX && next.height >= MIN_SELECTION_PX ? next : null
            );
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
        >
          <canvas ref={canvasRef} className="block h-auto w-full" />

          {overlayStyle ? (
            <div
              className="pointer-events-none absolute border-2 border-primary bg-primary/15"
              style={overlayStyle}
            />
          ) : null}

          {status === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-card/80">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!selection || saving || status !== "ready"}
            onClick={() => void attachSelection()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Crop className="h-4 w-4" aria-hidden="true" />
            )}
            {saving ? "Attaching" : "Attach to question"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!selection || saving}
            onClick={() => setSelection(null)}
          >
            Clear box
          </Button>
          <p className={cn("script-note", selection ? "text-primary" : null)}>
            {selection ? "Box ready — attach it." : "Drag across the figure to select it."}
          </p>
        </div>
      </Card>
    </div>
  );
}
