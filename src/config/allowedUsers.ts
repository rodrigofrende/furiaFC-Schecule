export const MASTER_PASSWORD = import.meta.env.VITE_MASTER_PASSWORD;

export const isMasterPasswordConfigured = () => Boolean(MASTER_PASSWORD && MASTER_PASSWORD.trim().length > 0);
