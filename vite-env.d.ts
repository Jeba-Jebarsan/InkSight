/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_REPLICATE_API_TOKEN: string;
    readonly VITE_CLERK_PUBLISHABLE_KEY: string;
    // Add other env variables here as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
