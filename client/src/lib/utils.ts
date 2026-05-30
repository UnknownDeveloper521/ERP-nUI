import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { API_BASE_URL } from "./config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateMiddle(text: string, startChars: number = 10, endChars: number = 8) {
  if (!text || text.length <= startChars + endChars + 3) return text;
  return `${text.substring(0, startChars)}...${text.substring(text.length - endChars)}`;
}

/**
 * Resolves a file URL to an absolute URL the browser can open.
 * Uses VITE_API_BASE_URL as base if relative.
 */
export function resolveFileUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  // Local blob preview URL — use as-is
  if (fileUrl.startsWith('blob:')) return fileUrl;
  // Already absolute
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
  
  const baseUrl = API_BASE_URL;
  const cleanUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  return `${baseUrl}${cleanUrl}`;
}

/**
 * Extracts only the filename from a path or URL.
 */
export function getFileName(path: string): string {
  if (!path) return '';
  return path.split(/[\\/]/).pop() || path;
}

/**
 * Truncates a filename while preserving its extension.
 */
export function truncateFileName(name: string, maxLength: number = 25): string {
  if (!name) return "";
  if (name.length <= maxLength) return name;
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex === -1) return name.substring(0, maxLength - 3) + "...";
  
  const extension = name.substring(lastDotIndex + 1);
  const nameWithoutExtension = name.substring(0, lastDotIndex);
  const truncatedName = nameWithoutExtension.substring(0, Math.max(0, maxLength - extension.length - 4));
  return `${truncatedName}...${extension}`;
}
