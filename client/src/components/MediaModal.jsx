// MediaModal.jsx
import React, { useEffect, useState } from "react";
import {
  getStorage,
  uploadBytes,
  ref,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./MediaModal.css";

const MediaModal = ({ isOpen, onClose, ticket, mediaURLs, setMediaURLs }) => {
  const [uploading, setUploading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState(null);

  if (!isOpen) return null;

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const storage = getStorage();
    setUploading(true);

    try {
      const newURLs = [];

      for (const file of files) {
        const imageRef = ref(
          storage,
          `uploadedFiles/Ticket${ticket.location}${ticket.ticketNum}/${file.name}`
        );
        await uploadBytes(imageRef, file);
        console.log(imageRef.fullPath);
        const url = imageRef.fullPath;
        newURLs.push(url);
      }

      const updatedURLs = [...mediaURLs, ...newURLs];

      // Save to Firestore
      await updateDoc(doc(db, "tickets", ticket.id), {
        mediaURLs: updatedURLs,
      });

      setMediaURLs(updatedURLs);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (index) => {
    const urlToDelete = mediaURLs[index];
    setDeletingIndex(index);

    try {
      const storage = getStorage();

      // Extract path from URL
      const pathStart = urlToDelete.indexOf("/o/") + 3;
      const pathEnd = urlToDelete.indexOf("?");

      const encodedPath = urlToDelete.slice(pathStart, pathEnd);
      const decodedPath = decodeURIComponent(encodedPath);

      const fileRef = ref(storage, decodedPath);
      await deleteObject(fileRef);

      // Update mediaURLs
      const updatedURLs = [...mediaURLs];
      updatedURLs.splice(index, 1);

      await updateDoc(doc(db, "tickets", ticket.id), {
        mediaFiles: updatedURLs,
      });

      setMediaURLs(updatedURLs);
    } catch (error) {
      console.error("Failed to delete image:", error);
      alert("Failed to delete image.");
    } finally {
      setDeletingIndex(null);
    }
  };

  return (
    <div className="media-modal-overlay">
      <div className="media-modal">
        <button className="close-button" onClick={onClose}>
          ×
        </button>
        <h3>📷 Device Images</h3>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
        />
        {uploading && <p>Uploading...</p>}
        {mediaURLs.length > 0 ? (
          <div className="media-modal-grid">
            {mediaURLs.map((url, index) => (
              <div key={index} className="media-item">
                <img
                  src={url}
                  alt={`Media ${index}`}
                  className="media-preview-modal"
                />
                <button
                  className="delete-button"
                  onClick={() => handleDelete(index)}
                  disabled={deletingIndex === index}
                >
                  {deletingIndex === index ? "..." : "🗑"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <h4>No images for this device</h4>
        )}
      </div>
    </div>
  );
};

export default MediaModal;
