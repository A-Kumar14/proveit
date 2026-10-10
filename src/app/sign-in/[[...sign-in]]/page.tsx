import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@proveit/app/_components/account/AuthShell";
import { authEnabled } from "@proveit/server/auth";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const enabled = authEnabled();
  return <AuthShell enabled={enabled} mode="in">{enabled && <SignIn />}</AuthShell>;
}
