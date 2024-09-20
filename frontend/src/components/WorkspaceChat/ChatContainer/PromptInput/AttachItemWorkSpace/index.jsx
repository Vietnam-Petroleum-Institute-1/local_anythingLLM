import useUser from "@/hooks/useUser";
import { PaperclipHorizontal } from "@phosphor-icons/react";
import { Tooltip } from "react-tooltip";
import { useRef } from "react";

/**
 * This is a simple proxy component that clicks on the DnD file uploader for the user.
 * Once the file is selected, it triggers the upload to the API.
 * @returns
 */
export default function AttachItem() {
  const { user } = useUser();
  const fileInputRef = useRef(null); // Use a ref to access the file input element

  // Function to upload the file
  const handleFileUpload = async (file) => {
    // const API_BASE = process.env.VITE_API_BASE || "";
    const API_BASE = "http://localhost:3001"; // Your API base URL
    const slug = "your-workspace-slug"; // Update this with the actual workspace slug
    const url = `${API_BASE}/workspace/${slug}/upload-and-embed-2`;

    const formData = new FormData();
    formData.append("file", file); // Assuming your API expects the file under the key "file"

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log("File uploaded successfully:", data);
      } else {
        console.error("Failed to upload file:", response.statusText);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  // Handle file selection
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileUpload(file); // Call the file upload function
    }
  };

  if (!!user && user.role === "default") return null;

  return (
    <>
      <button
        id="attach-item-btn"
        data-tooltip-id="attach-item-btn"
        data-tooltip-content="Attach a file to this chat"
        aria-label="Attach a file to this chat"
        type="button"
        onClick={(e) => {
          e?.target?.blur();
          fileInputRef.current?.click(); // Trigger the file input click
        }}
        className={`border-none relative flex justify-center items-center opacity-60 hover:opacity-100 cursor-pointer`}
      >
        <PaperclipHorizontal className="w-6 h-6 pointer-events-none text-[#FFCB02] rotate-90 -scale-y-100" />
        <Tooltip
          id="attach-item-btn"
          place="top"
          delayShow={300}
          className="tooltip !text-xs z-99"
        />
      </button>

      {/* Hidden file input */}
      <input
        type="file"
        id="dnd-chat-file-uploader"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </>
  );
}
