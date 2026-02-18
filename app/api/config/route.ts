// /app/api/config/route.ts
import { loadExternalConfig } from "@/lib/config-loader";
import type { NextRequest } from "next/server";

/**
 * API route that returns the cached config.
 * The config is loaded once at server startup and cached in memory,
 * so this endpoint is very fast and doesn't read from disk on each request.
 */
export async function GET(req: NextRequest) {
  try {
    // Get the cached config (loaded at server startup)
    const config = loadExternalConfig();
    
    return new Response(JSON.stringify(config), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour on client
      },
    });
  } catch (error) {
    console.error("❌ [Config API] Error loading config:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to load configuration",
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
