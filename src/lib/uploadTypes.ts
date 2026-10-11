/** What the course upload pickers offer. The server decides for real; this only filters the file dialog. */
export const UPLOAD_ACCEPT = [
  ".md", ".markdown", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".webp",
  ".docx", ".pptx", ".xlsx", ".html", ".htm", ".csv",
  "text/markdown", "text/plain", "application/pdf", "image/png", "image/jpeg", "image/webp", "text/html", "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

export const UPLOAD_TYPES_LABEL = "Markdown, text, PDF, Word, PowerPoint, Excel, HTML, CSV or images";
