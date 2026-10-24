import { defineConfig } from "@neon/config/v1";

// Apply only to reportAR-storage (steep-hill-04074866), never the São Paulo DB project.
export default defineConfig({ buckets: { "report-images": { access: "private" } } });
