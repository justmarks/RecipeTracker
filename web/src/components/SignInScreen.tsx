import { useAuth } from "../lib/useAuth";
import { Brand } from "./Brand";
import { Button } from "./ui";

/**
 * Landing screen shown to unauthenticated visitors. Centered card on
 * cream paper — Brand "stacked" variant at the top, Google + Microsoft
 * sign-in buttons, a one-line value prop, and a privacy note.
 *
 * Catches sign-in promise rejections to console so configuration issues
 * (provider not enabled, missing OAuth client) surface visibly during
 * development.
 */
export function SignInScreen() {
  const { signInWithGoogle, signInWithMicrosoft } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-100 p-8">
      <div className="w-full max-w-[440px] bg-white rounded-xl px-10 py-12 shadow-md text-center">
        <Brand variant="stacked" />

        <p className="font-sans text-sm leading-[1.6] text-ink-700 max-w-[320px] mx-auto mt-5 mb-7">
          Sign in to keep your recipes in one place. Search by ingredient,
          share with family, install to your phone.
        </p>

        <div className="flex flex-col gap-2.5">
          <Button
            variant="primary"
            size="lg"
            onClick={() =>
              signInWithGoogle().catch((err) =>
                console.error("Google sign-in:", err),
              )
            }
            className="w-full justify-center"
          >
            Continue with Google
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() =>
              signInWithMicrosoft().catch((err) =>
                console.error("Microsoft sign-in:", err),
              )
            }
            className="w-full justify-center"
          >
            Continue with Microsoft
          </Button>
        </div>

        <p className="mt-7 text-xs text-ink-500">
          Your recipes live in your account. Shared recipes are visible only
          to people you choose.
        </p>
      </div>
    </div>
  );
}
