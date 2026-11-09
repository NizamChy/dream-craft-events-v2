"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Uploads to the API, which resizes and converts the image to WebP. The
 * returned URL is stored in the form value.
 */
export function ImageUpload({
  value,
  onChange,
  invalid,
  aspect = "aspect-[16/10]",
  id,
}: {
  value: string;
  onChange: (url: string) => void;
  invalid?: boolean;
  aspect?: string;
  id?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return void toast.error("Choose an image file (JPG, PNG or WEBP).");
    if (file.size > MAX_BYTES) return void toast.error("Image must be 5MB or smaller.");
    const body = new FormData();
    body.append("image", file);
    setUploading(true);
    try {
      const res = await api<{ url: string }>("/uploads", { method: "POST", body });
      onChange(res.url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(errorMessage(err, "Upload failed. Try another image."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 transition-colors",
        aspect,
        invalid ? "border-destructive" : "border-border hover:border-primary/50",
      )}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) void handleFile(file);
      }}
    >
      {value ? (
        <>
          <Image src={value} alt="Uploaded preview" fill sizes="600px" className="object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-background/90 text-foreground shadow hover:bg-background"
            aria-label="Remove image"
          >
            <X className="size-4" />
          </button>
        </>
      ) : (
        <button
          type="button"
          id={id}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground outline-none focus-visible:bg-muted"
        >
          {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
          <span className="font-medium text-foreground">{uploading ? "Uploading and optimizing…" : "Click or drop an image"}</span>
          <span className="text-xs">JPG, PNG or WEBP, up to 5MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
