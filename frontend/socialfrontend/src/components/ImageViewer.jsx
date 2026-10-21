import React, { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

function ImageViewer({ src, alt = "Post image", onClose }) {
  const [zoom, setZoom] = useState(1);

  const handleWheel = (e) => {
    e.preventDefault();

    setZoom((prev) => {
      const next = prev - e.deltaY * 0.002;
      return Math.min(3, Math.max(0.5, next));
    });
  };

  useEffect(() => {
    setZoom(1);
  }, [src]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") {
        setZoom((prev) => Math.min(prev + 0.25, 3));
      }
      if (e.key === "-") {
        setZoom((prev) => Math.max(prev - 0.25, 0.5));
      }
      if (e.key === "0") setZoom(1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/95 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image preview"
        className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-lg transition duration-200 hover:scale-105 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <X size={24} strokeWidth={2.5} />
      </button>

      {/* Zoom controls */}
      <div
        className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/60 p-2 text-white shadow-xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
          disabled={zoom <= 0.5}
          aria-label="Zoom out"
          className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ZoomOut size={20} />
        </button>

        <span className="min-w-[54px] text-center text-sm font-medium tabular-nums">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={() => setZoom((prev) => Math.min(prev + 0.25, 3))}
          disabled={zoom >= 3}
          aria-label="Zoom in"
          className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ZoomIn size={20} />
        </button>

        <div className="mx-1 h-6 w-px bg-white/20" />

        <button
          type="button"
          onClick={() => setZoom(1)}
          disabled={zoom === 1}
          aria-label="Reset zoom"
          title="Reset zoom"
          className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Image */}
      <div
        className="flex h-full w-full items-center justify-center cursor-pointer overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onDoubleClick={() => setZoom((prev) => (prev === 1 ? 2 : 1))}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            transition: "transform 200ms ease",
          }}
          className="max-h-[85vh] max-w-full rounded-lg object-contain select-none"
        />
      </div>
    </div>
  );
}

export default ImageViewer;
