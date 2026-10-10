import "server-only";

/**
 * PROVEIT_DATA=demo starts with made-up progress, two sample courses and a sample calendar, so every screen has something to show.
 * Anything else starts empty and progress comes only from attempts.
 */
export const demoData = () => process.env.PROVEIT_DATA === "demo";
