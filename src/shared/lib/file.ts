export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'Kb', 'Mb', 'Gb', 'Tb'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** index).toFixed(2))} ${sizes[index]}`;
};

export const formatProgressBytes = (bytes: number, sizeBytes: number) => {
  if (sizeBytes === 0) return '0 Bytes';

  const sizes = ['Bytes', 'Kb', 'Mb', 'Gb', 'Tb'] as const;
  const index = Math.min(Math.floor(Math.log(sizeBytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / 1024 ** index;

  return index === 0
    ? `${Math.round(value)} ${sizes[index]}`
    : `${value.toFixed(2)} ${sizes[index]}`;
};
