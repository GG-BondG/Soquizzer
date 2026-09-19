// One-line description of a picked file list for the upload rows in forms.
export function fileSummary(files, empty) {
  if (files.length === 0) return empty;
  return files.length === 1 ? files[0].name : `${files.length} files selected`;
}
