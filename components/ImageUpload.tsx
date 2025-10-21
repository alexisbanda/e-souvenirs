import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import imageCompression from 'browser-image-compression';

interface ImageUploadProps {
  onUrlsChange: (urls: string[]) => void;
  initialUrls?: string[];
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUrlsChange, initialUrls = [] }) => {
  const [imageUrls, setImageUrls] = useState<string[]>(initialUrls);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (imageUrls.length + acceptedFiles.length > 3) {
      setError('No se pueden subir más de 3 imágenes.');
      return;
    }
    setError(null);
    setUploading(true);

    const compressionOptions = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    const uploadPromises = acceptedFiles.map(async file => {
      try {
        const compressedFile = await imageCompression(file, compressionOptions);

        if (compressedFile.size > 5 * 1024 * 1024) { // 5MB limit
            setError(`La imagen ${file.name} es demasiado grande. El límite es 5MB.`);
            return Promise.resolve(null);
        }

        const storageRef = ref(storage, `products/${Date.now()}_${compressedFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, compressedFile);

        return new Promise<string | null>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              // Optional: display upload progress
            },
            (error) => {
              console.error("Upload failed:", error);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      } catch (error) {
        console.error('Error compressing image:', error);
        setError(`Error al comprimir la imagen ${file.name}.`);
        return null;
      }
    });

    Promise.all(uploadPromises).then(urls => {
      const newUrls = urls.filter((url): url is string => url !== null);
      const updatedUrls = [...imageUrls, ...newUrls];
      setImageUrls(updatedUrls);
      onUrlsChange(updatedUrls);
      setUploading(false);
    }).catch(err => {
      setError('Ocurrió un error al subir las imágenes.');
      setUploading(false);
    });

  }, [imageUrls, onUrlsChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif'] },
    multiple: true
  });

  const removeImage = (index: number) => {
    const newImageUrls = [...imageUrls];
    newImageUrls.splice(index, 1);
    setImageUrls(newImageUrls);
    onUrlsChange(newImageUrls);
  };

  return (
    <div>
      <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
        <input {...getInputProps()} />
        {
          isDragActive ?
            <p>Suelta las imágenes aquí...</p> :
            <p>Arrastra y suelta algunas imágenes aquí, o haz clic para seleccionar archivos (Máx 3, 5MB c/u)</p>
        }
      </div>
      {uploading && <p>Subiendo imágenes...</p>}
      {error && <p className="text-red-500">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-4">
        {imageUrls.map((url, index) => (
          <div key={index} className="relative">
            <img src={url} alt={`preview ${index}`} className="w-32 h-32 object-cover rounded-lg" />
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUpload;
