
import { Smile } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ImageUploader from "./ImageUploader";
import { toast } from "sonner";
import { useAuth } from "../api/authContext/UserContext";
import { getMentionUsers } from "../api/follows";
import EmojiPicker from "emoji-picker-react";

function WhatHappening() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [mentionUsers, setMentionUsers] = useState([]);
  const [mentionUsersLoaded, setMentionUsersLoaded] = useState(false);
  const [mentionState, setMentionState] = useState(null);
  const [selectedMentions, setSelectedMentions] = useState([]);
  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("postoraAppearance") || "light"
  );

  const composerRef = useRef(null);
  const textareaRef = useRef(null);

  const { user } = useAuth();

  const isDarkTheme = appearance === "dark";
  const isCustomTheme = appearance === "custom";

  const composerClass = isDarkTheme
    ? "bg-[#1b1e25] border-[#343843] text-gray-100"
    : isCustomTheme
      ? "bg-[#f5f3ff] border-[#ded8f4] text-[#292344]"
      : "bg-white border-gray-200 text-gray-900";

  const textareaClass = isDarkTheme
    ? "bg-[#111318] text-gray-100 placeholder:text-gray-400 focus:border-[#343843] focus:bg-[#111318] focus:ring-[#343843]"
    : isCustomTheme
      ? "bg-[#ede9fe] text-[#292344] placeholder:text-[#77708e] focus:border-[#b8aceb] focus:bg-white focus:ring-[#ded8f4]"
      : "bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:border-blue-200 focus:bg-white focus:ring-blue-50";

  const getId = (person) =>
    String(person?._id || person?.id || person || "");

  // Load people the current user can mention.
  useEffect(() => {
    let active = true;

    const loadMentionUsers = async () => {
      try {
        const users = await getMentionUsers();

        if (active) {
          setMentionUsers(Array.isArray(users) ? users : []);
        }
      } catch (error) {
        console.error("Failed to load mention users:", error);
      } finally {
        if (active) {
          setMentionUsersLoaded(true);
        }
      }
    };

    loadMentionUsers();

    return () => {
      active = false;
    };
  }, []);

  // Keep the existing focus-composer behavior.
  useEffect(() => {
    const handleFocusComposer = () => {
      setIsHighlighted(true);

      composerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 400);

      setTimeout(() => {
        setIsHighlighted(false);
      }, 2000);
    };

    window.addEventListener("focus-post-composer", handleFocusComposer);

    return () => {
      window.removeEventListener(
        "focus-post-composer",
        handleFocusComposer
      );
    };
  }, []);


  useEffect(() => {
    const handleThemeChange = (event) => {
      setAppearance(
        event.detail?.appearance ||
        localStorage.getItem("postoraAppearance") ||
        "light"
      );
    };

    window.addEventListener("postora-theme-change", handleThemeChange);

    return () => {
      window.removeEventListener("postora-theme-change", handleThemeChange);
    };
  }, []);

  const getMentionMatches = () => {
    if (!mentionState) return [];

    const query = mentionState.query.toLowerCase();

    return mentionUsers.filter(
      (person) =>
        getId(person) !== getId(user) &&
        person.username?.toLowerCase().includes(query)
    );
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;

    setText(value);

    // Keep only mentions whose exact text remains unchanged.
    setSelectedMentions((previous) =>
      previous
        .filter(
          (mention) =>
            value.slice(mention.start, mention.end) === mention.text
        )
        .map((mention) => {
          const oldText = text;
          const newText = value;

          let prefixLength = 0;

          while (
            prefixLength < oldText.length &&
            prefixLength < newText.length &&
            oldText[prefixLength] === newText[prefixLength]
          ) {
            prefixLength++;
          }

          let oldSuffix = oldText.length;
          let newSuffix = newText.length;

          while (
            oldSuffix > prefixLength &&
            newSuffix > prefixLength &&
            oldText[oldSuffix - 1] === newText[newSuffix - 1]
          ) {
            oldSuffix--;
            newSuffix--;
          }

          const difference = newSuffix - oldSuffix;

          if (mention.end <= prefixLength) return mention;

          if (mention.start >= oldSuffix) {
            return {
              ...mention,
              start: mention.start + difference,
              end: mention.end + difference,
            };
          }

          return mention;
        })
        .filter(
          (mention) =>
            mention.start >= 0 &&
            mention.end <= value.length &&
            value.slice(mention.start, mention.end) === mention.text
        )
    );

    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);

    if (match) {
      const atIndex =
        cursorPosition - match[0].length + match[0].indexOf("@");

      setMentionState({
        query: match[1],
        start: atIndex,
        end: cursorPosition,
      });
    } else {
      setMentionState(null);
    }
  };

  const selectMention = (person) => {
    if (!mentionState) return;

    const userId = getId(person);

    if (!userId) return;

    const before = text.slice(0, mentionState.start);
    const after = text.slice(mentionState.end);
    const mentionText = `@${person.username}`;
    const insertedText = `${mentionText} `;
    const start = before.length;
    const end = start + mentionText.length;

    const updatedText = before + insertedText + after;

    setSelectedMentions((previous) => {
      const shift = insertedText.length - (mentionState.end - mentionState.start);

      const remaining = previous
        .filter(
          (mention) =>
            mention.end <= mentionState.start ||
            mention.start >= mentionState.end
        )
        .map((mention) =>
          mention.start >= mentionState.end
            ? {
              ...mention,
              start: mention.start + shift,
              end: mention.end + shift,
            }
            : mention
        );

      return [
        ...remaining,
        {
          user: userId,
          start,
          end,
          text: mentionText,
        },
      ].sort((a, b) => a.start - b.start);
    });

    setText(updatedText);
    setMentionState(null);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        start + insertedText.length,
        start + insertedText.length
      );
    });
  };

  const mentionMatches = getMentionMatches();

  const handlePost = async () => {
    if (!text.trim() && !uploadedImage && !uploadedVideo) {
      toast.error("Write something or select media first.");
      return;
    }

    setPosting(true);

    try {
      const formData = new FormData();
      formData.append("text", text);
      formData.append(
        "mentions",
        JSON.stringify(
          selectedMentions.map(({ user, start, end }) => ({
            user,
            start,
            end,
          }))
        )
      );

      if (uploadedImage) {
        formData.append("image", uploadedImage);
      }

      if (uploadedVideo) {
        formData.append("video", uploadedVideo);
      }

      const res = await fetch("http://localhost:5000/posts", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create post.");
      }

      setText("");
      setSelectedMentions([]);
      setUploadedImage(null);
      setUploadedVideo(null);
      setMentionState(null);
      setShowEmojiPicker(false);

      toast.success("Post created successfully!");

      window.dispatchEvent(new Event("posts-updated"));
    } catch (error) {
      toast.error(error.message || "Failed to create post.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      id="what-happening"
      ref={composerRef}
      className={`w-full rounded-xl border p-3 transition-all duration-300 sm:p-5 ${composerClass} ${isHighlighted
        ? "border-[#2764de] ring-4 ring-blue-100"
        : ""
        }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <img
          src={user?.avatar || "/avatar.png"}
          alt={user?.name || "User"}
          className="h-10 w-10 shrink-0 rounded-full border border-gray-100 object-cover sm:h-11 sm:w-11"
        />

        <div className="min-w-0 flex-1">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (
                  e.key === "Escape" &&
                  mentionState
                ) {
                  setMentionState(null);
                }
              }}
              placeholder="What's happening? Type @ to mention someone"
              rows={2}
              maxLength={99999}
              className={`w-full resize-none rounded-xl border border-transparent px-3 py-3 text-sm outline-none transition focus:ring-2 sm:text-base ${textareaClass}`}
            />

            {mentionState && (
              <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full max-w-sm overflow-y-auto rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
                {!mentionUsersLoaded ? (
                  <p className="px-4 py-3 text-sm text-gray-500">
                    Loading people...
                  </p>
                ) : mentionMatches.length > 0 ? (
                  mentionMatches.map((person) => (
                    <button
                      key={getId(person)}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectMention(person)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-blue-50"
                    >
                      <img
                        src={person.avatar || "/avatar.png"}
                        alt={person.name || "User"}
                        className="h-9 w-9 rounded-full object-cover"
                      />

                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-gray-800">
                          {person.name}
                        </span>

                        <span className="truncate text-xs text-gray-500">
                          @{person.username}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm text-gray-500">
                    No matching followers or following.
                  </p>
                )}
              </div>
            )}
          </div>

          {uploadedImage && (
            <div className="relative mt-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
              <img
                className="max-h-80 w-full object-contain"
                src={URL.createObjectURL(uploadedImage)}
                alt="Selected upload"
              />

              <button
                type="button"
                onClick={() => setUploadedImage(null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Remove image
              </button>
            </div>
          )}

          {uploadedVideo && (
            <div className="relative mt-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-2">
              <video
                src={URL.createObjectURL(uploadedVideo)}
                controls
                playsInline
                className="max-h-80 w-full rounded-lg"
              />

              <button
                type="button"
                onClick={() => setUploadedVideo(null)}
                className="mt-2 rounded-full bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300"
              >
                Remove video
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-nowrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <div className="flex flex-nowrap items-center gap-0.5 text-[#2764de] sm:gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                <ImageUploader
                  mediaType="image"
                  onImageUpload={(file) => {
                    setUploadedVideo(null);
                    setUploadedImage(file);
                  }}
                />
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                <ImageUploader
                  mediaType="video"
                  onVideoUpload={(file) => {
                    setUploadedImage(null);
                    setUploadedVideo(file);
                  }}
                />
              </div>

              <div className="relative">
                <button
                  type="button"
                  aria-label="Add emoji"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${showEmojiPicker
                    ? isDarkTheme
                      ? "bg-white text-[#2764de]"
                      : isCustomTheme
                        ? "bg-[#e2dcf7] text-[#2764de]"
                        : "bg-blue-50 text-[#2764de]"
                    : isDarkTheme
                      ? "text-[#2764de] hover:bg-white"
                      : isCustomTheme
                        ? "text-[#2764de] hover:bg-[#e2dcf7] hover:text-[#2764de]"
                        : "text-[#2764de] hover:bg-blue-50"
                    }`}
                >
                  <Smile size={19} />
                </button>

                {showEmojiPicker && (
                  <div className="absolute left-0 top-full z-50 mt-2">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        setText((prev) => prev + emojiData.emoji);
                        textareaRef.current?.focus();
                      }}
                      width={300}
                      height={350}
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePost}
              disabled={
                posting ||
                (!text.trim() && !uploadedImage && !uploadedVideo)
              }
              className="shrink-0 rounded-full bg-[#2764de] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WhatHappening;
