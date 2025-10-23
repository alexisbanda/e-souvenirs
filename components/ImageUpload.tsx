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
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (imageUrls.length + acceptedFiles.length > 3) {
      setErrors({ general: 'No se pueden subir más de 3 imágenes.' });
      return;
    }
    setErrors({});
    setUploadProgress({});

    const compressionOptions = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    const uploadPromises = acceptedFiles.map(file => {
      return (async () => {
        try {
          const compressedFile = await imageCompression(file, compressionOptions);

          if (compressedFile.size > 1 * 1024 * 1024) { // 1MB limit
            throw new Error(`La imagen es demasiado grande, incluso después de la compresión.`);
          }

          const storageRef = ref(storage, `products/${Date.now()}_${compressedFile.name}`);
          const uploadTask = uploadBytesResumable(storageRef, compressedFile);

          return new Promise<string>((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
              },
              (error) => {
                console.error("Upload failed:", error);
                reject(new Error('Falló la subida a Firebase.'));
              },
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              }
            );
          });
        } catch (error: any) {
          console.error('Error processing image:', error);
          throw new Error(error.message || `Error al procesar la imagen.`);
        }
      })();
    });

    const results = await Promise.allSettled(uploadPromises.map((p, i) => 
      p.catch(err => {
        const fileName = acceptedFiles[i].name;
        setErrors(prev => ({ ...prev, [fileName]: err.message }));
        return Promise.reject(err);
      })
    ));

    const newUrls = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
      .map(result => result.value);

    if (newUrls.length > 0) {
      const updatedUrls = [...imageUrls, ...newUrls];
      setImageUrls(updatedUrls);
      onUrlsChange(updatedUrls);
    }
    
    // Clear progress for completed files
    setTimeout(() => {
        setUploadProgress(prev => {
            const newProgress = { ...prev };
            acceptedFiles.forEach(file => {
                if (newProgress[file.name] === 100) {
                    delete newProgress[file.name];
                }
            });
            return newProgress;
        });
    }, 2000);


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
            <p>Arrastra y suelta algunas imágenes aquí, o haz clic para seleccionar archivos (Máx 3, 1MB c/u)</p>
        }
      </div>
      
      {errors.general && <p className="text-red-500 mt-2">{errors.general}</p>}

      <div className="mt-4 space-y-2">
        {Object.entries(uploadProgress).map(([name, progress]) => (
          <div key={name}>
            <p className="text-sm font-medium">{name}</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            {errors[name] && <p className="text-red-500 text-sm mt-1">{errors[name]}</p>}
          </div>
        ))}
        {Object.entries(errors).filter(([key]) => key !== 'general' && !uploadProgress[key]).map(([name, error]) => (
            <div key={name}>
                <p className="text-sm font-medium text-red-500">{name}: {error}</p>
            </div>
        ))}
      </div>

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
