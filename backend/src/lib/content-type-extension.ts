export function contentTypeToExtension(
  contentType: string | null,
): string | null {
  switch (contentType) {
    case "audio/aac":
      return "aac";
    case "audio/flac":
      return "flac";
    case "audio/mp4":
    case "audio/x-m4a":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    case "text/html":
      return "html";
    case "video/mp2t":
      return "ts";
    default:
      return null;
  }
}
