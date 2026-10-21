
import React, { useRef } from "react";
import { ImagePlus, Film } from "lucide-react";
import { toast } from "sonner";

function ImageUploader({
  onImageUpload,
  onVideoUpload,
  mediaType = "image",
}) {
  const fileInputRef = useRef(null);

  const isVideo = mediaType === "video";

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    // Allow selecting the same file again.
    event.target.value = "";

    if (!file) return;

    const validType = isVideo
      ? file.type.startsWith("video/")
      : file.type.startsWith("image/");

    if (!validType) {
      toast.error(
        isVideo
          ? "Please select a video file."
          : "Please select an image file.",
      );
      return;
    }

    const maxSize = 100 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error("The maximum file size is 100 MB.");
      return;
    }

    if (!isVideo) {
      onImageUpload?.(file);
      return;
    }

    const videoElement = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    videoElement.preload = "metadata";

    videoElement.onloadedmetadata = () => {
      const duration = videoElement.duration;

      URL.revokeObjectURL(objectUrl);
      videoElement.removeAttribute("src");
      videoElement.load();

      if (!Number.isFinite(duration)) {
        toast.error("Could not determine the video duration.");
        return;
      }

      if (duration > 60) {
        toast.error("Videos must be between 30 and 60 seconds long.");
        return;
      }

      onVideoUpload?.(file);
      toast.success("Video selected successfully.");
    };

    videoElement.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      videoElement.removeAttribute("src");
      videoElement.load();

      toast.error("Could not read this video. Please try another file.");
    };

    videoElement.src = objectUrl;
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={isVideo ? "video/*" : "image/*"}
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        aria-label={isVideo ? "Upload video" : "Upload image"}
        title={isVideo ? "Upload video (30–60 seconds)" : "Upload image"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#2764de] transition hover:bg-blue-50"
      >
        {isVideo ? <Film size={20} /> : <ImagePlus size={20} />}
      </button>
    </>
  );
}

export default ImageUploader;
