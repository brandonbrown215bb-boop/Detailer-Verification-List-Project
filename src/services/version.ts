import metadata from '../../version.json' with { type: 'json' };

/**
 * Shared product metadata. Rule Pack identity remains owned by the packaged
 * rule-pack manifest and is intentionally not duplicated here.
 */
export const APPLICATION_VERSION = metadata.version;
export const DVL_FORMAT_VERSION = metadata.dvlFormatVersion;
export const DOCUMENT_SCHEMA_VERSION = metadata.documentSchemaVersion;

// Release jobs may inject the explicit tag version at build time. Development
// and ordinary source builds continue to read the checked-in authoritative
// metadata file above.
const injectedApplicationVersion = (typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_APP_VERSION : (typeof process !== 'undefined' ? process.env.VITE_APP_VERSION : undefined))?.trim();
export const EFFECTIVE_APPLICATION_VERSION = injectedApplicationVersion || APPLICATION_VERSION;
