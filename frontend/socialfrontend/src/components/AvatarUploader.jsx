import { Camera, MoreVertical } from "lucide-react";
import React, { useRef, useState } from "react";

function AvatarUploader({ src, size = 64, disabled = false, onUpload, onRemove }) {
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleChangeAvatar = () => {
    setMenuOpen(false);
    fileInputRef.current.click();
  };

  const handleRemoveAvatar = () => {
    setMenuOpen(false);
    onRemove();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    onUpload(file);

    // Allows selecting the same image again later
    e.target.value = "";
  };

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
    >
      {/* Avatar */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setMenuOpen(!menuOpen)}
        className="relative w-full h-full rounded-full overflow-hidden"
      >
        <img
          src={src || "/avatar.png"}
          alt="Profile"
          className="w-full h-full object-cover"
        />

        {!disabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition">
            <Camera size={20} className="text-white" />
          </div>
        )}
      </button>

      {/* Menu */}
      {!disabled && menuOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <button
            type="button"
            onClick={handleChangeAvatar}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
          >
            Change Avatar
          </button>

          <button
            type="button"
            onClick={handleRemoveAvatar}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
          >
            Remove Avatar
          </button>
        </div>
      )}

      {/* File input */}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </div>
  );
}

export default AvatarUploader;