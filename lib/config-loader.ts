import path from "path";
import fs from "fs";
import "dotenv/config";

// Cache the config at module load time (server startup)
// This ensures the file is only read once, not on every request
let cachedConfig: any = null;
let configLoadError: Error | null = null;

/**
 * Loads the external config file and caches it in memory.
 * The config is read once at server startup and reused for all requests.
 * 
 * @returns The parsed config object
 * @throws Error if the config file cannot be read or parsed
 */
export function loadExternalConfig() {
  // Return cached config if already loaded
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  // If there was a previous error, throw it
  if (configLoadError) {
    throw configLoadError;
  }

  try {
    // Use the same logic as the API route
    const configPath = process.env.CONFIG_PATH || 
      "C:\\Users\\talha\\Documents\\consulting\\fincontinuo\\6_Chatbot\\config_leadgen.json";
    
    // Resolve the path if it's relative
    const resolvedPath = path.isAbsolute(configPath) 
      ? configPath 
      : path.resolve(process.cwd(), configPath);
    
    console.log("📦 [ConfigLoader] Loading config from:", resolvedPath);
    
    const raw = fs.readFileSync(resolvedPath, "utf-8");
    cachedConfig = JSON.parse(raw);
    
    console.log("✅ [ConfigLoader] Config loaded and cached successfully");
    return cachedConfig;
  } catch (error) {
    configLoadError = error instanceof Error ? error : new Error(String(error));
    console.error("❌ [ConfigLoader] Failed to load config:", configLoadError);
    throw configLoadError;
  }
}

/**
 * Clears the cached config (useful for testing or hot-reloading in development)
 */
export function clearConfigCache() {
  cachedConfig = null;
  configLoadError = null;
}

/**
 * Gets the cached config without attempting to load it
 * @returns The cached config or null if not loaded yet
 */
export function getCachedConfig() {
  return cachedConfig;
}
