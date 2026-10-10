import { ConverseInput } from "@proveit/lib/schemas";
import { nextTurn } from "@proveit/server/converse";
import { handle } from "@proveit/server/route";

export const maxDuration = 60;
export const POST = (req: Request) => handle(req, ConverseInput, nextTurn);
