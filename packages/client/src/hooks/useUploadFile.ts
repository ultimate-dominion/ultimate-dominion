import { useCallback, useState } from 'react';

import { API_URL } from '../utils/constants';

export const useUploadFile = ({
  fileName,
}: {
  fileName: string;
}): {
  file: File | null;
  setFile: (file: File | null) => void;
  onRemove: () => void;
  isUploading: boolean;
  onUpload: () => Promise<string>;
  isUploaded: boolean;
} => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);

  const onSetFile = useCallback((file: File | null): void => {
    setFile(file);
    setIsUploaded(false);
  }, []);

  const onRemove = useCallback((): void => {
    setFile(null);
    setIsUploaded(false);
  }, []);

  const onUpload = useCallback(async (): Promise<string> => {
    if (!file) {
      return '';
    }

    try {
      setIsUploading(true);

      if (file.size > 1048576) {
        throw new Error('Max file size exceeded');
      }
      const formData = new FormData();
      formData.set(fileName, file);

      const response = await fetch(
        `${API_URL}/api/uploadFile?name=${fileName}`,
        {
          method: 'POST',
          body: formData,
        },
      );
      const { cid } = await response.json();
      if (!cid) {
        throw new Error('Error uploading file');
      }

      setIsUploaded(true);
      return cid;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return '';
    } finally {
      setIsUploading(false);
    }
  }, [file, fileName]);

  return {
    file,
    setFile: onSetFile,
    isUploading,
    onUpload,
    onRemove,
    isUploaded,
  };
};
