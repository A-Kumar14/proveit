import { ConverseInput } from "@proveit/lib/schemas";
import { audit } from "@proveit/server/converse";
import { handle } from "@proveit/server/route";

export const maxDuration = 60;
export const POST = (req: Request) => handle(req, ConverseInput, audit);
